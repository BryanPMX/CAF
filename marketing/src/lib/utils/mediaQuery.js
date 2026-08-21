function noop() {}

export function listenForMediaChange(query, callback) {
  if (typeof query?.addEventListener === 'function') {
    query.addEventListener('change', callback);
    return () => query.removeEventListener('change', callback);
  }

  if (typeof query?.addListener === 'function') {
    query.addListener(callback);
    return () => query.removeListener(callback);
  }

  return noop;
}
