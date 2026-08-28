/**
 * Navigable bookmarks (`/Outlines`).
 *
 * `pdf-lib` has no high-level outline API, so the dictionary is written by hand against
 * `pdf.context`. The library arrives as a **parameter**, never an import: a value import of
 * `pdf-lib` anywhere under `utils/pdf/` would drag it back into the entry chunk, which
 * `npm run verify:entry` exists to prevent.
 *
 * A reader with a twelve-page report and no bookmarks scrolls; the contents page on the cover
 * covers the same ground on paper, so if this ever proves brittle it can be dropped without
 * costing the document anything it cannot otherwise say.
 */
import type { PDFDocument } from 'pdf-lib';

/** The slice of `pdf-lib` this module needs, handed over by the caller that imported it. */
export interface OutlineFactories {
  PDFName: typeof import('pdf-lib').PDFName;
  PDFArray: typeof import('pdf-lib').PDFArray;
  PDFNumber: typeof import('pdf-lib').PDFNumber;
  PDFHexString: typeof import('pdf-lib').PDFHexString;
}

export interface OutlineEntry {
  title: string;
  pageIndex: number;
}

export const attachOutline = (
  pdf: PDFDocument,
  { PDFName, PDFArray, PDFNumber, PDFHexString }: OutlineFactories,
  entries: readonly OutlineEntry[],
): void => {
  if (!entries.length) return;
  const context = pdf.context;
  const pages = pdf.getPages();
  const usable = entries.filter((entry) => pages[entry.pageIndex] !== undefined);
  if (!usable.length) return;

  const rootRef = context.nextRef();
  const itemRefs = usable.map(() => context.nextRef());

  usable.forEach((entry, index) => {
    // `/XYZ null null null` means "this page, keep the reader's zoom and position" — the
    // least surprising jump, and the one that survives a viewer with its own zoom setting.
    const destination = PDFArray.withContext(context);
    destination.push(pages[entry.pageIndex].ref);
    destination.push(PDFName.of('XYZ'));
    destination.push(PDFName.of('null'));
    destination.push(PDFName.of('null'));
    destination.push(PDFName.of('null'));

    const item = context.obj({
      // Hex strings carry UTF-16, so an accented section title survives the bookmark.
      Title: PDFHexString.fromText(entry.title),
      Parent: rootRef,
      Dest: destination,
    });
    if (index > 0) item.set(PDFName.of('Prev'), itemRefs[index - 1]);
    if (index < usable.length - 1) item.set(PDFName.of('Next'), itemRefs[index + 1]);
    context.assign(itemRefs[index], item);
  });

  context.assign(rootRef, context.obj({
    Type: PDFName.of('Outlines'),
    First: itemRefs[0],
    Last: itemRefs[itemRefs.length - 1],
    Count: PDFNumber.of(usable.length),
  }));
  pdf.catalog.set(PDFName.of('Outlines'), rootRef);
  // Open the bookmark pane on load: an outline nobody can see is an outline nobody uses.
  pdf.catalog.set(PDFName.of('PageMode'), PDFName.of('UseOutlines'));
};
