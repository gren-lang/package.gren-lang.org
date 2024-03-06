const OPEN_BRACES = "{";
const CLOSE_BRACES = "}";

const COLON = ":";
const COMMA = ",";

const WHITESPACES = [" ", "\t", "\b", "\n", "\r"];

const OPEN_BRACKETS = "(";
const CLOSE_BRACKETS = ")";

const LAMBDA = "->";

const SIG_SYNTAX = [
  OPEN_BRACES,
  CLOSE_BRACES,
  COLON,
  COMMA,
  OPEN_BRACKETS,
  CLOSE_BRACKETS,
];

function lex(input) {
  let cursor = 0;
  let tokens = [];
  const inputLen = input.length;

  while (cursor < inputLen) {
    const char = input[cursor];
    let cursorInc = 1;
    if (SIG_SYNTAX.includes(char)) {
      tokens = tokens.concat(char);
    } else if (char.match(/[a-z\.]/i)) {
      let innerCursor = 0;
      let innerChar = char;
      let str = "";
      while (true) {
        str = str + innerChar;
        innerCursor = innerCursor + 1;
        innerChar = input[cursor + innerCursor];
        if (!innerChar || !innerChar.match(/[a-z\.]/i)) {
          break;
        }
      }
      tokens = tokens.concat(str);
      cursorInc = str.length;
    } else if (char === "-") {
      if (input[cursor + 1] === ">") {
        tokens = tokens.concat("->");
        cursorInc = 2;
      } else {
        throw new Error(`Expected ">" after '-' at ${cursor + 1}`);
      }
    } else if (WHITESPACES.includes(char)) {
      // skip whitespaces
    } else {
      throw new Error(`Invalid Character found "${char}" at ${cursor + 1}`);
    }
    cursor = cursor + cursorInc;
  }

  return tokens;
}

function formatAsArray(inputTokens) {
  let cursor = 0;
  let start = 0;
  let tokens = [];
  let counts = {
    [OPEN_BRACES]: 0,
    [OPEN_BRACKETS]: 0,
  };
  const inputLen = inputTokens.length;

  while (cursor < inputLen) {
    let cursorInc = 1;
    let currentToken = inputTokens[cursor];

    switch (currentToken) {
      case OPEN_BRACES:
      case OPEN_BRACKETS:
        if (
          cursor === 0 &&
          (currentToken === OPEN_BRACES || currentToken === OPEN_BRACKETS)
        ) {
          start = cursor;
        }
        counts[currentToken] = counts[currentToken] + 1;
        break;
      case CLOSE_BRACES:
        if (inputTokens[cursor - 1] !== OPEN_BRACES) {
          let arr = inputTokens.slice(start, cursor);
          if (arr[0] !== LAMBDA && inputTokens[cursor + 1] === COMMA) {
            arr = arr.concat(currentToken);
            cursor = cursor + 1;
          }

          if (arr[0] === LAMBDA && inputTokens[cursor + 1] === LAMBDA) {
            arr = arr.concat(inputTokens[cursor]);
            cursor = cursor + 1;
          }
          if (inputTokens[cursor + 1] === CLOSE_BRACKETS) {
            arr = arr.concat(inputTokens[cursor], inputTokens[cursor + 1]);
            cursor = cursor + 2;
            counts[CLOSE_BRACKETS] = counts[CLOSE_BRACKETS] - 1;
            counts[CLOSE_BRACES] = counts[CLOSE_BRACES] - 1;
          }
          if (inputTokens[cursor + 1] === CLOSE_BRACES) {
            arr = arr.concat(inputTokens[cursor + 1]);
            cursor = cursor + 1;
            counts[OPEN_BRACES] = counts[OPEN_BRACES] - 1;
          }
          tokens = tokens.concat(arr.join(" "));
          start = cursor;
        }

        counts[OPEN_BRACES] = counts[OPEN_BRACES] - 1;
        break;
      case CLOSE_BRACKETS:
        let arr = inputTokens.slice(start, cursor);
        arr = arr.concat(currentToken);
        cursor = cursor + 1;
        if (inputTokens[cursor] === CLOSE_BRACKETS) {
          arr = arr.concat(inputTokens[cursor]);
          cursor = cursor + 1;
          counts[OPEN_BRACKETS] = counts[OPEN_BRACKETS] - 1;
        }
        tokens = tokens.concat(arr.join(" "));
        start = cursor;

        counts[OPEN_BRACKETS] = counts[OPEN_BRACKETS] - 1;
        continue;
      case COMMA:
        if (
          inputTokens[start] !== LAMBDA &&
          counts[OPEN_BRACES] === 1 &&
          counts[OPEN_BRACKETS] === 0
        ) {
          const arr = inputTokens.slice(start, cursor);
          tokens = tokens.concat(arr.join(" "));
          start = cursor;
        }
        break;
      case LAMBDA:
        if (counts[OPEN_BRACES] === 0 && counts[OPEN_BRACKETS] === 0) {
          const arr = inputTokens.slice(start, cursor);
          tokens = tokens.concat(arr.join(" "));
          start = cursor;
        }
        break;
      default:
        break;
    }

    if (cursor === inputLen - 1) {
      let arr = inputTokens.slice(start, cursor).concat(inputTokens[cursor]);
      tokens = tokens.concat(arr.join(" "));
      start = cursor;
    }

    cursor = cursor + cursorInc;
  }

  tokens = tokens.map((line) => {
    return line
      .replace("{ }", "{}")
      .replace(" , ", ", ")
      .replace("} )", "})")
      .replace("( {", "({")
      .replace(") )", "))")
      .replace(/[a-z] \)/, (match) => {
        return match.replace(" ", "");
      })
      .replace(/\( [a-zA-Z]/, (match) => {
        return match.replace(" ", "");
      });
  });

  return tokens.filter((token) => Boolean(token));
}

export function splitTypeSignature(strType) {
  try {
    return formatAsArray(lex(strType));
  } catch (err) {
    console.error(err);
    return [strType];
  }
}
