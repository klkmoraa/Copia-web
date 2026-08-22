export const downloadPortableBytes =(bytes: Uint8Array, filename: string, mimeType: string): void => {
  const url = URL.createObjectURL(new Blob([bytes as BlobPart], { type: mimeType }));
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.style.display = 'none';
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  // iOS Safari may still be consuming the object URL after the synthetic click.
  window.setTimeout(() => URL.revokeObjectURL(url), 30_000);
};

export const shareOrDownloadPortableBytes = async (
  bytes: Uint8Array,
  filename: string,
  mimeType: string,
  title = 'Expediente structureCo',
): Promise<'shared' | 'downloaded' | 'cancelled'> => {
  const file = new File([bytes as BlobPart], filename, { type: mimeType });
  if (typeof navigator.share === 'function' && navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title });
      return 'shared';
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return 'cancelled';
      // Safari can reject after an async export loses transient user activation.
    }
  }
  downloadPortableBytes(bytes, filename, mimeType);
  return 'downloaded';
};
