import { ViewPlugin, Decoration, WidgetType } from '@codemirror/view';
import { RangeSetBuilder } from '@codemirror/state';

class RhymeSchemeWidget extends WidgetType {
  constructor(schemeLetter) {
    super();
    this.schemeLetter = schemeLetter;
  }
  
  eq(other) {
    return other.schemeLetter === this.schemeLetter;
  }
  
  toDOM() {
    const wrap = document.createElement("span");
    wrap.className = "cm-rhyme-scheme";
    wrap.textContent = `(${this.schemeLetter})`;
    return wrap;
  }
}

export const rhymeSchemePlugin = ViewPlugin.fromClass(
  class {
    decorations;

    constructor(view) {
      this.decorations = this.buildDecorations(view);
    }

    update(update) {
      if (update.docChanged || update.viewportChanged) {
        this.decorations = this.buildDecorations(update.view);
      }
    }

    buildDecorations(view) {
      const builder = new RangeSetBuilder();
      
      const rhymeMap = {};
      let nextLetterIndex = 0;
      
      function getSchemeLetter(index) {
        return String.fromCharCode(65 + (index % 26));
      }
      
      for (let { from, to } of view.visibleRanges) {
        const doc = view.state.doc;
        const startLine = doc.lineAt(from);
        const endLine = doc.lineAt(to);
        
        for (let i = startLine.number; i <= endLine.number; i++) {
          const line = doc.line(i);
          const lineText = line.text;
          
          if (!lineText.trim()) continue;
          
          if (lineText.match(/^\s*\[.*?\]\s*$/)) {
             continue; // ignore section headers
          }
          
          const words = lineText.match(/[a-zA-Z']+/g);
          const lastWord = words ? words[words.length - 1] : null;
          
          if (!lastWord) continue;
          
          const cleanWord = lastWord.toLowerCase().replace(/[^a-z]/g, '');
          if (cleanWord.length === 0) continue;
          
          let rhymeKey = null;
          if (cleanWord.length >= 4) {
             rhymeKey = cleanWord.slice(-3);
          } else if (cleanWord.length >= 2) {
             rhymeKey = cleanWord.slice(-2);
          }
          
          if (!rhymeKey) continue;
          
          if (!(rhymeKey in rhymeMap)) {
             rhymeMap[rhymeKey] = getSchemeLetter(nextLetterIndex);
             nextLetterIndex++;
          }
          
          const letter = rhymeMap[rhymeKey];
          
          // Add decoration at the end of the line
          if (line.to <= to) {
            builder.add(line.to, line.to, Decoration.widget({
              widget: new RhymeSchemeWidget(letter),
              side: 1
            }));
          }
        }
      }
      return builder.finish();
    }
  },
  {
    decorations: (v) => v.decorations,
  }
);
