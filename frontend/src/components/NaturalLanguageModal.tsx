import { useState } from 'react';
import { Sparkles, X, Plus } from 'lucide-react';
import { ItemRequirement } from '../types';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onAddItems: (items: ItemRequirement[]) => void;
}

export function NaturalLanguageModal({ isOpen, onClose, onAddItems }: Props) {
  const [text, setText] = useState('');

  if (!isOpen) return null;

  const parseText = () => {
    if (!text.trim()) return;

    // Split on newlines, commas, or "e poi", "e anche", "e"
    const lines = text
      .split(/\n|,|\be\s+poi\b|\be\s+anche\b/i)
      .map((l) => l.trim())
      .filter((l) => l.length > 1);

    const parsed: ItemRequirement[] = lines.map((line, idx) => {
      let qty = 1;
      let unit = 'unit';
      let cleanName = line;

      // Extract quantities: e.g. "2 pacchi", "1 litro", "500g", "1,5 kg"
      const kgMatch = line.match(/(\d+(?:[.,]\d+)?)\s*(?:kg|chili|chilo)\b/i);
      const gMatch = line.match(/(\d+(?:[.,]\d+)?)\s*(?:g|gr|grammi)\b/i);
      const lMatch = line.match(/(\d+(?:[.,]\d+)?)\s*(?:l|lt|litro|litri)\b/i);
      const pzMatch = line.match(/(\d+)\s*(?:pz|pezzi|pacchi|pacco|confezioni|conf|bottiglie)\b/i);

      if (kgMatch) {
        qty = parseFloat(kgMatch[1].replace(',', '.')) * 1000;
        unit = 'g';
        cleanName = line.replace(kgMatch[0], '').replace(/\bdi\b/i, '').trim();
      } else if (gMatch) {
        qty = parseFloat(gMatch[1].replace(',', '.'));
        unit = 'g';
        cleanName = line.replace(gMatch[0], '').replace(/\bdi\b/i, '').trim();
      } else if (lMatch) {
        qty = parseFloat(lMatch[1].replace(',', '.')) * 1000;
        unit = 'ml';
        cleanName = line.replace(lMatch[0], '').replace(/\bdi\b/i, '').trim();
      } else if (pzMatch) {
        qty = parseInt(pzMatch[1], 10);
        unit = 'unit';
        cleanName = line.replace(pzMatch[0], '').replace(/\bdi\b/i, '').trim();
      } else {
        // Fallback: check leading number, e.g. "2 latte"
        const numMatch = line.match(/^(\d+)\s+/);
        if (numMatch) {
          qty = parseInt(numMatch[1], 10);
          cleanName = line.replace(numMatch[0], '').trim();
        }
      }

      // Cleanup leading "di", "un po di", "circa"
      cleanName = cleanName
        .replace(/^(circa|un po' di|un po di|delle|del|della|dei|degli|da)\s+/i, '')
        .trim();

      // Capitalize first letter
      cleanName = cleanName.charAt(0).toUpperCase() + cleanName.slice(1);

      return {
        item_id: `nl_${Date.now()}_${idx}`,
        name: cleanName || line,
        min_quantity: qty,
        base_unit: unit,
        is_mandatory: true,
        preferred_brands: [],
      };
    });

    if (parsed.length > 0) {
      onAddItems(parsed);
      setText('');
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm animate-in fade-in">
      <div className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-5 shadow-xl">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2 text-slate-900 font-bold">
            <Sparkles className="h-5 w-5 text-emerald-600" />
            <span>Inserisci Spesa in Linguaggio Naturale</span>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <p className="mt-3 text-xs text-slate-500">
          Incolla o detta la tua lista informale della spesa. Il sistema riconosce automaticamente quantità, pesi (g, kg, litri, pacchi) e prodotti:
        </p>

        <textarea
          rows={5}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Es: 2 pacchi di spaghetti barilla, 1 litro di latte parzialmente scremato, un chilo di mele, 500g di caffè per moka..."
          className="mt-3 w-full rounded-xl border border-slate-200 p-3 text-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-100 font-normal leading-relaxed"
        />

        <div className="mt-4 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 transition"
          >
            Annulla
          </button>
          <button
            type="button"
            onClick={parseText}
            disabled={!text.trim()}
            className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2 text-xs font-bold text-white transition hover:bg-emerald-700 disabled:opacity-50"
          >
            <Plus className="h-4 w-4" />
            Estrai e Aggiungi alla Lista
          </button>
        </div>
      </div>
    </div>
  );
}
