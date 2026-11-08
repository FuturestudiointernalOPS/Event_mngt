export function readCookie(name: string): string | null {
  const entry = document.cookie
    .split('; ')
    .find((row) => row.startsWith(`${name}=`));

  if (!entry) {
    return null;
  }

  return decodeURIComponent(entry.slice(name.length + 1));
}
