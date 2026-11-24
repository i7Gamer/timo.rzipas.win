export function editDistance(word: string, name: string) {
  let row = Array.from({ length: name.length + 1 }, (_, index) => index);
  for (const [index, letter] of [...word].entries()) {
    const next = [index + 1];
    for (const [column, other] of [...name].entries()) {
      next.push(
        Math.min(
          row[column + 1] + 1,
          next[column] + 1,
          row[column] + Number(letter !== other),
        ),
      );
    }
    row = next;
  }
  return row[name.length];
}
