/**
 * Every user-visible string, in pt-BR, English and German. A test checks that the three tables
 * have the same keys and the same {placeholders}, so a missing translation fails the build.
 */
export const LANGS = ['pt', 'en', 'de'];

export function pickLang(browserLang) {
  const l = String(browserLang ?? '').toLowerCase();
  if (l.startsWith('pt')) return 'pt';
  if (l.startsWith('de')) return 'de';
  return 'en';
}

export function format(s, params = {}) {
  return s.replace(/\{(\w+)\}/g, (m, k) => (k in params ? String(params[k]) : m));
}

export const STRINGS = {
  pt: {
    app: { title: 'Partitura de bateria', untitled: 'Sem título' },
    lang: { pt: 'PT', en: 'EN', de: 'DE', choose: 'Idioma' },
    theme: { light: 'Tema claro', dark: 'Tema escuro', toggle: 'Alternar tema claro/escuro' },
    value: {
      whole: 'Semibreve', half: 'Mínima', quarter: 'Semínima',
      eighth: 'Colcheia', sixteenth: 'Semicolcheia', thirtySecond: 'Fusa',
    },
    valuePlural: {
      whole: 'semibreves', half: 'mínimas', quarter: 'semínimas',
      eighth: 'colcheias', sixteenth: 'semicolcheias', thirtySecond: 'fusas',
    },
    slot: {
      hihatPedal: 'Chimbal (pé)', kick: 'Bumbo', floorTom: 'Surdo', snare: 'Caixa',
      midTom: 'Tom médio', highTom: 'Tom agudo', hihat: 'Chimbal', ride: 'Ride', crash: 'Crash',
    },
    palette: {
      figure: 'Figura', tuplet: 'Quiáltera', articulation: 'Articulação', hand: 'Mão', edit: 'Edição',
      tupletN: 'Quiáltera de {n}', tupletShort: '{n} em 1',
      rest: 'Pausa', restHint: 'Esvazia a célula',
      accent: 'Acento', ghost: 'Fantasma', ghostLong: 'Nota fantasma',
      right: 'Direita', left: 'Esquerda', rightLong: 'Mão direita', leftLong: 'Mão esquerda',
      delete: 'Apagar', deleteHint: 'Tocar numa nota a remove', undo: 'Desfazer',
    },
    editor: {
      back: 'Arquivo', backLong: 'Voltar ao arquivo', titleField: 'Título', bpm: 'BPM',
      pdf: 'PDF', pdfLong: 'Imprimir ou salvar PDF',
      addBar: 'Adicionar compasso', removeBar: 'Remover compasso', confirmRemoveBar: 'Remover o compasso {n}?',
      prevBar: 'Compasso anterior', nextBar: 'Próximo compasso', prevPos: 'Posição anterior', nextPos: 'Próxima posição',
      where: 'Compasso {bar} de {total} · tempo {beat}', saved: 'salvo {time}', notSaved: 'nada alterado ainda',
      wholeScore: 'Partitura inteira', goToBar: 'Ir ao compasso {n}', colours: 'Cores por figura',
      colourReset: 'Padrão', landscapeHint: 'Na horizontal o tempo em foco fica maior.', ok: 'ok', barAria: 'Compasso',
    },
    status: {
      opened: 'Aberto: {title}', newScore: 'Partitura nova', empty: 'vazio',
      nothingToDelete: 'Nada para apagar em {pos}', deleted: 'Apagado em {pos} → {notes}', placed: '{pos}: {notes}',
      split: 'Tempo {pos} dividido em {value}', tupletOn: 'Quiáltera de {n}', tupletOff: 'Quiáltera desligada',
      rest: 'Pausa em {pos}', position: 'Posição {pos}: {notes}', end: 'Fim da partitura', start: 'Início da partitura',
      deleteOn: 'Modo apagar: toque numa nota para removê-la', deleteOff: 'Modo apagar desligado',
      accentOn: 'Acento ligado para as próximas notas', accentOff: 'Acento desligado',
      ghostOn: 'Nota fantasma ligada', ghostOff: 'Nota fantasma desligada',
      hand: 'Mão {hand}', noHand: 'Sem mão marcada',
      barAdded: 'Compasso {n} adicionado', barMinimum: 'A partitura precisa de pelo menos um compasso',
      barRemoved: 'Compasso removido ({n} restantes)', undone: 'Desfeito', nothingToUndo: 'Nada para desfazer',
      titleSet: 'Título atualizado', bpmSet: 'BPM: {bpm}', notFocused: 'Posição {pos} não está em foco. Use ‹ › para mover.',
      colourSet: 'Cor de {value} alterada', colourReset: 'Cor de {value} voltou ao padrão',
      theme: 'Tema: {theme}', lang: 'Idioma: português',
    },
    archive: {
      heading: 'Partituras de bateria', sub: 'Tudo fica neste navegador. Exporte em JSON para ter uma cópia ou levar a outro aparelho.',
      count: '{n} partitura(s) neste navegador', newScore: '+ Nova partitura', newPrompt: 'Título da partitura',
      newDefault: 'Novo exercício', cancelled: 'Criação cancelada', created: 'Criada: {title}',
      importOpen: 'Importar JSON', importClose: 'Fechar importação', importHelp: 'Como importar de uma foto',
      importFile: 'Arquivo .json', importPaste: 'ou cole o JSON aqui', importPasted: 'Importar o texto colado',
      imported: 'Importada: {title} ({n} compasso(s))', importFailed: 'Importação falhou: {error}',
      noFile: 'Nenhum arquivo escolhido', readFile: 'Lido {name} ({n} caracteres)',
      empty: 'Nenhuma partitura ainda. Crie uma nova ou importe um JSON.',
      bars: '{n} compasso(s)', edit: 'Editar', pdf: 'PDF', json: 'JSON', duplicate: 'Duplicar', remove: 'Apagar',
      confirmRemove: 'Apagar "{title}"? Não dá para desfazer.', notRemoved: 'Nada apagado', removed: 'Apagada: {title}',
      exported: 'Exportada: {title} ({file})', copySuffix: '(cópia)', duplicated: 'Duplicada: {title}',
    },
    print: {
      back: 'Editor', barsPerLine: 'Compassos por linha', print: 'Imprimir / salvar PDF',
      tip: 'No diálogo de impressão, escolha "Salvar como PDF".', notFound: 'Partitura não encontrada.', backShort: 'Voltar',
    },
  },

  en: {
    app: { title: 'Drum notation', untitled: 'Untitled' },
    lang: { pt: 'PT', en: 'EN', de: 'DE', choose: 'Language' },
    theme: { light: 'Light theme', dark: 'Dark theme', toggle: 'Switch light/dark theme' },
    value: {
      whole: 'Whole', half: 'Half', quarter: 'Quarter',
      eighth: 'Eighth', sixteenth: 'Sixteenth', thirtySecond: '32nd',
    },
    valuePlural: {
      whole: 'whole notes', half: 'half notes', quarter: 'quarter notes',
      eighth: 'eighth notes', sixteenth: 'sixteenth notes', thirtySecond: '32nd notes',
    },
    slot: {
      hihatPedal: 'Hi-hat (foot)', kick: 'Bass drum', floorTom: 'Floor tom', snare: 'Snare',
      midTom: 'Mid tom', highTom: 'High tom', hihat: 'Hi-hat', ride: 'Ride', crash: 'Crash',
    },
    palette: {
      figure: 'Note value', tuplet: 'Tuplet', articulation: 'Articulation', hand: 'Hand', edit: 'Edit',
      tupletN: 'Tuplet of {n}', tupletShort: '{n} in 1',
      rest: 'Rest', restHint: 'Empties the cell',
      accent: 'Accent', ghost: 'Ghost', ghostLong: 'Ghost note',
      right: 'Right', left: 'Left', rightLong: 'Right hand', leftLong: 'Left hand',
      delete: 'Delete', deleteHint: 'Tap a note to remove it', undo: 'Undo',
    },
    editor: {
      back: 'Library', backLong: 'Back to the library', titleField: 'Title', bpm: 'BPM',
      pdf: 'PDF', pdfLong: 'Print or save as PDF',
      addBar: 'Add bar', removeBar: 'Remove bar', confirmRemoveBar: 'Remove bar {n}?',
      prevBar: 'Previous bar', nextBar: 'Next bar', prevPos: 'Previous position', nextPos: 'Next position',
      where: 'Bar {bar} of {total} · beat {beat}', saved: 'saved {time}', notSaved: 'nothing changed yet',
      wholeScore: 'Whole score', goToBar: 'Go to bar {n}', colours: 'Colours per note value',
      colourReset: 'Default', landscapeHint: 'Turn the phone sideways for a bigger beat.', ok: 'ok', barAria: 'Bar',
    },
    status: {
      opened: 'Opened: {title}', newScore: 'New score', empty: 'empty',
      nothingToDelete: 'Nothing to delete at {pos}', deleted: 'Deleted at {pos} → {notes}', placed: '{pos}: {notes}',
      split: 'Beat {pos} split into {value}', tupletOn: 'Tuplet of {n}', tupletOff: 'Tuplet off',
      rest: 'Rest at {pos}', position: 'Position {pos}: {notes}', end: 'End of the score', start: 'Start of the score',
      deleteOn: 'Delete mode: tap a note to remove it', deleteOff: 'Delete mode off',
      accentOn: 'Accent on for the next notes', accentOff: 'Accent off',
      ghostOn: 'Ghost note on', ghostOff: 'Ghost note off',
      hand: 'Hand {hand}', noHand: 'No hand marked',
      barAdded: 'Bar {n} added', barMinimum: 'A score needs at least one bar',
      barRemoved: 'Bar removed ({n} left)', undone: 'Undone', nothingToUndo: 'Nothing to undo',
      titleSet: 'Title updated', bpmSet: 'BPM: {bpm}', notFocused: 'Position {pos} is not in focus. Use ‹ › to move.',
      colourSet: 'Colour of {value} changed', colourReset: 'Colour of {value} back to default',
      theme: 'Theme: {theme}', lang: 'Language: English',
    },
    archive: {
      heading: 'Drum scores', sub: 'Everything stays in this browser. Export JSON to back up or move to another device.',
      count: '{n} score(s) in this browser', newScore: '+ New score', newPrompt: 'Score title',
      newDefault: 'New exercise', cancelled: 'Creation cancelled', created: 'Created: {title}',
      importOpen: 'Import JSON', importClose: 'Close import', importHelp: 'How to import from a photo',
      importFile: '.json file', importPaste: 'or paste the JSON here', importPasted: 'Import the pasted text',
      imported: 'Imported: {title} ({n} bar(s))', importFailed: 'Import failed: {error}',
      noFile: 'No file chosen', readFile: 'Read {name} ({n} characters)',
      empty: 'No scores yet. Create one or import a JSON file.',
      bars: '{n} bar(s)', edit: 'Edit', pdf: 'PDF', json: 'JSON', duplicate: 'Duplicate', remove: 'Delete',
      confirmRemove: 'Delete "{title}"? This cannot be undone.', notRemoved: 'Nothing deleted', removed: 'Deleted: {title}',
      exported: 'Exported: {title} ({file})', copySuffix: '(copy)', duplicated: 'Duplicated: {title}',
    },
    print: {
      back: 'Editor', barsPerLine: 'Bars per line', print: 'Print / save PDF',
      tip: 'In the print dialog, choose "Save as PDF".', notFound: 'Score not found.', backShort: 'Back',
    },
  },

  de: {
    app: { title: 'Schlagzeugnoten', untitled: 'Ohne Titel' },
    lang: { pt: 'PT', en: 'EN', de: 'DE', choose: 'Sprache' },
    theme: { light: 'Helles Design', dark: 'Dunkles Design', toggle: 'Hell/Dunkel umschalten' },
    value: {
      whole: 'Ganze', half: 'Halbe', quarter: 'Viertel',
      eighth: 'Achtel', sixteenth: 'Sechzehntel', thirtySecond: '32tel',
    },
    valuePlural: {
      whole: 'Ganze', half: 'Halbe', quarter: 'Viertel',
      eighth: 'Achtel', sixteenth: 'Sechzehntel', thirtySecond: '32tel',
    },
    slot: {
      hihatPedal: 'Hi-Hat (Fuß)', kick: 'Bassdrum', floorTom: 'Standtom', snare: 'Snare',
      midTom: 'Mitteltom', highTom: 'Hochtom', hihat: 'Hi-Hat', ride: 'Ride', crash: 'Crash',
    },
    palette: {
      figure: 'Notenwert', tuplet: 'Tole', articulation: 'Artikulation', hand: 'Hand', edit: 'Bearbeiten',
      tupletN: '{n}er-Tole', tupletShort: '{n} auf 1',
      rest: 'Pause', restHint: 'Leert die Zelle',
      accent: 'Akzent', ghost: 'Ghost', ghostLong: 'Ghost Note',
      right: 'Rechts', left: 'Links', rightLong: 'Rechte Hand', leftLong: 'Linke Hand',
      delete: 'Löschen', deleteHint: 'Note antippen, um sie zu entfernen', undo: 'Rückgängig',
    },
    editor: {
      back: 'Bibliothek', backLong: 'Zurück zur Bibliothek', titleField: 'Titel', bpm: 'BPM',
      pdf: 'PDF', pdfLong: 'Drucken oder als PDF speichern',
      addBar: 'Takt hinzufügen', removeBar: 'Takt entfernen', confirmRemoveBar: 'Takt {n} entfernen?',
      prevBar: 'Vorheriger Takt', nextBar: 'Nächster Takt', prevPos: 'Vorherige Position', nextPos: 'Nächste Position',
      where: 'Takt {bar} von {total} · Schlag {beat}', saved: 'gespeichert {time}', notSaved: 'noch nichts geändert',
      wholeScore: 'Ganze Partitur', goToBar: 'Zu Takt {n}', colours: 'Farben je Notenwert',
      colourReset: 'Standard', landscapeHint: 'Im Querformat wird der Schlag größer.', ok: 'ok', barAria: 'Takt',
    },
    status: {
      opened: 'Geöffnet: {title}', newScore: 'Neue Partitur', empty: 'leer',
      nothingToDelete: 'Nichts zu löschen bei {pos}', deleted: 'Gelöscht bei {pos} → {notes}', placed: '{pos}: {notes}',
      split: 'Schlag {pos} in {value} geteilt', tupletOn: '{n}er-Tole', tupletOff: 'Tole aus',
      rest: 'Pause bei {pos}', position: 'Position {pos}: {notes}', end: 'Ende der Partitur', start: 'Anfang der Partitur',
      deleteOn: 'Löschmodus: Note antippen, um sie zu entfernen', deleteOff: 'Löschmodus aus',
      accentOn: 'Akzent an für die nächsten Noten', accentOff: 'Akzent aus',
      ghostOn: 'Ghost Note an', ghostOff: 'Ghost Note aus',
      hand: 'Hand {hand}', noHand: 'Keine Hand markiert',
      barAdded: 'Takt {n} hinzugefügt', barMinimum: 'Eine Partitur braucht mindestens einen Takt',
      barRemoved: 'Takt entfernt ({n} übrig)', undone: 'Rückgängig gemacht', nothingToUndo: 'Nichts rückgängig zu machen',
      titleSet: 'Titel geändert', bpmSet: 'BPM: {bpm}', notFocused: 'Position {pos} ist nicht im Fokus. Mit ‹ › bewegen.',
      colourSet: 'Farbe für {value} geändert', colourReset: 'Farbe für {value} auf Standard',
      theme: 'Design: {theme}', lang: 'Sprache: Deutsch',
    },
    archive: {
      heading: 'Schlagzeugnoten', sub: 'Alles bleibt in diesem Browser. Als JSON exportieren, um zu sichern oder auf ein anderes Gerät zu bringen.',
      count: '{n} Partitur(en) in diesem Browser', newScore: '+ Neue Partitur', newPrompt: 'Titel der Partitur',
      newDefault: 'Neue Übung', cancelled: 'Abgebrochen', created: 'Erstellt: {title}',
      importOpen: 'JSON importieren', importClose: 'Import schließen', importHelp: 'Aus einem Foto importieren',
      importFile: '.json-Datei', importPaste: 'oder JSON hier einfügen', importPasted: 'Eingefügten Text importieren',
      imported: 'Importiert: {title} ({n} Takt(e))', importFailed: 'Import fehlgeschlagen: {error}',
      noFile: 'Keine Datei gewählt', readFile: '{name} gelesen ({n} Zeichen)',
      empty: 'Noch keine Partituren. Neue anlegen oder JSON importieren.',
      bars: '{n} Takt(e)', edit: 'Bearbeiten', pdf: 'PDF', json: 'JSON', duplicate: 'Duplizieren', remove: 'Löschen',
      confirmRemove: '"{title}" löschen? Das lässt sich nicht rückgängig machen.', notRemoved: 'Nichts gelöscht', removed: 'Gelöscht: {title}',
      exported: 'Exportiert: {title} ({file})', copySuffix: '(Kopie)', duplicated: 'Dupliziert: {title}',
    },
    print: {
      back: 'Editor', barsPerLine: 'Takte pro Zeile', print: 'Drucken / PDF speichern',
      tip: 'Im Druckdialog "Als PDF speichern" wählen.', notFound: 'Partitur nicht gefunden.', backShort: 'Zurück',
    },
  },
};
