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

export function isSingleTypo(word: string, expected: string) {
  if (word === expected || Math.abs(word.length - expected.length) > 1)
    return false;

  let first = 0;
  while (first < word.length && word[first] === expected[first]) first++;
  const after = first + 1;
  if (word.length === expected.length) {
    return (
      word.slice(after) === expected.slice(after) ||
      (word[first] === expected[after] &&
        word[after] === expected[first] &&
        word.slice(after + 1) === expected.slice(after + 1))
    );
  }

  const [longer, shorter] =
    word.length > expected.length ? [word, expected] : [expected, word];
  return longer.slice(after) === shorter.slice(first);
}
