export function getOrInsertComputed<K, V>(map: Map<K, V>, key: K, callback: (key: K) => V): V;
export function getOrInsertComputed<K extends WeakKey, V>(map: WeakMap<K, V>, key: K, callback: (key: K) => V): V;
export function getOrInsertComputed<K extends WeakKey, V>(
  map: WeakMap<K, V> | Map<K, V>,
  key: K,
  callback: (key: K) => V,
): V {
  if (map.has(key)) {
    return map.get(key)!;
  }
  const value = callback(key);
  map.set(key, value);
  return value;
}
