"""Deterministic grocery basket optimization engine using Google OR-Tools CP-SAT."""

import time
from typing import Dict, List, Optional, Tuple
from ortools.sat.python import cp_model

from .schemas import (
    AllocatedItem,
    ItemRequirement,
    OptimizationConfig,
    OptimizationResult,
    ProductOffer,
    Store,
    StoreAllocation,
)


def _to_cents(amount_eur: float) -> int:
    """Convert EUR to integer cents to guarantee exact integer arithmetic."""
    return int(round(amount_eur * 100))


def _to_eur(cents: int) -> float:
    """Convert integer cents back to EUR float rounded to 2 decimal places."""
    return round(cents / 100.0, 2)


class GroceryBasketOptimizer:
    """Solves the multi-store grocery basket allocation problem using CP-SAT."""

    def __init__(
        self,
        items: List[ItemRequirement],
        stores: List[Store],
        offers: List[ProductOffer],
        config: Optional[OptimizationConfig] = None,
    ):
        self.items = {item.item_id: item for item in items}
        self.stores = {store.store_id: store for store in stores}
        self.config = config or OptimizationConfig()

        # Filter offers: only keep offers for requested items and acceptable brands
        self.offers: List[ProductOffer] = []
        for offer in offers:
            if offer.item_id not in self.items or offer.store_id not in self.stores:
                continue
            item = self.items[offer.item_id]
            if item.acceptable_brands is not None:
                if offer.brand and offer.brand not in item.acceptable_brands:
                    continue
            self.offers.append(offer)

    def solve(self) -> OptimizationResult:
        """Execute the optimization model and return structured results."""
        start_time = time.perf_counter()

        # Pre-check: Ensure all mandatory items have at least one valid candidate offer
        items_with_offers = {o.item_id for o in self.offers}
        unfulfilled = [
            item_id for item_id, item in self.items.items()
            if item.is_mandatory and item_id not in items_with_offers
        ]

        if unfulfilled:
            return OptimizationResult(
                status="INFEASIBLE",
                total_cost=0.0,
                product_cost=0.0,
                travel_cost=0.0,
                unfulfilled_items=unfulfilled,
                solver_time_ms=round((time.perf_counter() - start_time) * 1000, 2),
            )

        model = cp_model.CpModel()

        # 1. Decision Variables
        # y[s] = 1 if store s is visited, 0 otherwise
        y: Dict[str, cp_model.IntVar] = {}
        for store_id in self.stores:
            y[store_id] = model.NewBoolVar(f"visit_store_{store_id}")

        # x[o] = integer number of packages of offer o purchased
        # z[o] = binary indicator if offer o is selected (z[o] = 1 iff x[o] >= 1)
        x: Dict[str, cp_model.IntVar] = {}
        z: Dict[str, cp_model.IntVar] = {}

        for offer in self.offers:
            item = self.items[offer.item_id]
            # Calculate a safe upper bound on packages needed
            max_qty = item.max_quantity or (item.min_quantity * 2.0)
            upper_bound = max(1, int(round(max_qty / offer.package_base_quantity)) + 1)

            x[offer.offer_id] = model.NewIntVar(0, upper_bound, f"qty_offer_{offer.offer_id}")
            z[offer.offer_id] = model.NewBoolVar(f"chosen_offer_{offer.offer_id}")

            # Link x and z: z = 1 <=> x >= 1
            model.Add(x[offer.offer_id] >= z[offer.offer_id])
            model.Add(x[offer.offer_id] <= upper_bound * z[offer.offer_id])

            # Link offer to store: can only buy offer if store is visited
            model.Add(x[offer.offer_id] <= upper_bound * y[offer.store_id])
            model.Add(z[offer.offer_id] <= y[offer.store_id])

        # 2. Constraints

        # Max number of stores visited
        model.Add(sum(y[s_id] for s_id in self.stores) <= self.config.max_stores)

        # Quantity requirements per item
        for item_id, item in self.items.items():
            item_offers = [o for o in self.offers if o.item_id == item_id]
            if not item_offers:
                continue

            # Quantities in base units (grams, ml, pieces)
            total_qty_expr = sum(
                x[o.offer_id] * int(round(o.package_base_quantity))
                for o in item_offers
            )

            if item.is_mandatory:
                model.Add(total_qty_expr >= int(round(item.min_quantity)))

            if item.max_quantity is not None:
                model.Add(total_qty_expr <= int(round(item.max_quantity)))

            # Single-SKU constraint: do not mix multiple variants/brands for the same item
            if self.config.enforce_single_sku_per_item:
                model.Add(sum(z[o.offer_id] for o in item_offers) <= 1)

        # 3. Objective Function (in integer cents)
        # Minimize: Sum of Product Costs + Sum of Store Visit Costs
        objective_terms = []

        # Product costs
        for offer in self.offers:
            price_cents = _to_cents(offer.package_price)
            objective_terms.append(x[offer.offer_id] * price_cents)

        # Store visit costs
        for store_id, store in self.stores.items():
            visit_cents = _to_cents(store.visit_cost)
            objective_terms.append(y[store_id] * visit_cents)

        model.Minimize(sum(objective_terms))

        # 4. Solve
        solver = cp_model.CpSolver()
        solver.parameters.max_time_in_seconds = self.config.time_limit_seconds
        solver.parameters.num_search_workers = 4

        status = solver.Solve(model)
        solve_time_ms = round((time.perf_counter() - start_time) * 1000, 2)

        if status not in (cp_model.OPTIMAL, cp_model.FEASIBLE):
            return OptimizationResult(
                status="INFEASIBLE" if status == cp_model.INFEASIBLE else "UNKNOWN",
                total_cost=0.0,
                product_cost=0.0,
                travel_cost=0.0,
                solver_time_ms=solve_time_ms,
            )

        # 5. Extract Solution
        allocations_by_store: Dict[str, StoreAllocation] = {}
        total_prod_cents = 0
        total_travel_cents = 0

        for store_id, store in self.stores.items():
            if solver.Value(y[store_id]) == 1:
                visit_cents = _to_cents(store.visit_cost)
                total_travel_cents += visit_cents
                allocations_by_store[store_id] = StoreAllocation(
                    store_id=store_id,
                    store_name=store.name,
                    store_chain=store.chain,
                    visit_cost=store.visit_cost,
                    items=[],
                    subtotal_products=0.0,
                )

        for offer in self.offers:
            qty = solver.Value(x[offer.offer_id])
            if qty > 0:
                item = self.items[offer.item_id]
                item_price_cents = _to_cents(offer.package_price) * qty
                total_prod_cents += item_price_cents

                allocated_item = AllocatedItem(
                    item_id=offer.item_id,
                    item_name=item.name,
                    variant_id=offer.variant_id,
                    variant_name=offer.variant_name,
                    brand=offer.brand,
                    package_quantity=qty,
                    unit_price=offer.package_price,
                    total_price=_to_eur(item_price_cents),
                    base_quantity_per_pack=offer.package_base_quantity,
                    total_base_quantity=round(offer.package_base_quantity * qty, 2),
                    is_promotion=offer.is_promotion,
                )
                allocations_by_store[offer.store_id].items.append(allocated_item)
                allocations_by_store[offer.store_id].subtotal_products = round(
                    allocations_by_store[offer.store_id].subtotal_products + allocated_item.total_price, 2
                )

        # Calculate baseline single store comparison to measure savings
        savings = self._calculate_savings_vs_single_store(
            total_optimal_cents=total_prod_cents + total_travel_cents
        )

        return OptimizationResult(
            status="OPTIMAL" if status == cp_model.OPTIMAL else "FEASIBLE",
            total_cost=_to_eur(total_prod_cents + total_travel_cents),
            product_cost=_to_eur(total_prod_cents),
            travel_cost=_to_eur(total_travel_cents),
            estimated_savings_vs_single_store=savings,
            selected_stores=list(allocations_by_store.values()),
            solver_time_ms=solve_time_ms,
        )

    def _calculate_savings_vs_single_store(self, total_optimal_cents: int) -> Optional[float]:
        """Calculates savings compared to the best possible single-store trip."""
        single_store_costs: List[int] = []

        for store_id, store in self.stores.items():
            store_offers = [o for o in self.offers if o.store_id == store_id]
            # Check if all mandatory items are available at this single store
            available_items = {o.item_id for o in store_offers}
            mandatory_items = {i.item_id for i in self.items.values() if i.is_mandatory}

            if not mandatory_items.issubset(available_items):
                continue  # Cannot fulfill full list at this store alone

            # Compute cost at this single store
            store_cost = _to_cents(store.visit_cost)
            possible = True
            for item_id in mandatory_items:
                item = self.items[item_id]
                candidates = [o for o in store_offers if o.item_id == item_id]
                if not candidates:
                    possible = False
                    break
                # Find cheapest candidate pack option
                best_cost = None
                for cand in candidates:
                    packs = max(1, int(round(item.min_quantity / cand.package_base_quantity)))
                    if packs * cand.package_base_quantity < item.min_quantity:
                        packs += 1
                    cost = packs * _to_cents(cand.package_price)
                    if best_cost is None or cost < best_cost:
                        best_cost = cost
                if best_cost is not None:
                    store_cost += best_cost

            if possible:
                single_store_costs.append(store_cost)

        if not single_store_costs:
            return None

        best_single_store_cents = min(single_store_costs)
        savings_cents = max(0, best_single_store_cents - total_optimal_cents)
        return _to_eur(savings_cents)
