// test/e2e/harness/css-parser.js
// CSS parser and inspector for extension styles, media queries, and touch targets

import fs from 'fs';

export class ParsedCSS {
  constructor(rawCss) {
    this.rawCss = rawCss;
    this.rootVariables = new Map();
    this.globalRules = new Map(); // selector -> Map(property -> value)
    this.mediaQueries = new Map(); // queryCondition -> Map(selector -> Map(property -> value))
    this.parse(rawCss);
  }

  parse(css) {
    // Strip comments
    const stripped = css.replace(/\/\*[\s\S]*?\*\//g, '');

    // Parse @media queries
    const mediaRegex = /@media\s*([^{]+)\{([\s\S]*?\})\s*\}/g;
    let mediaMatch;
    let lastMediaEnd = 0;
    const nonMediaSegments = [];

    while ((mediaMatch = mediaRegex.exec(stripped)) !== null) {
      const condition = mediaMatch[1].trim();
      const mediaBody = mediaMatch[2];
      const startIndex = mediaMatch.index;

      nonMediaSegments.push(stripped.slice(lastMediaEnd, startIndex));
      lastMediaEnd = startIndex + mediaMatch[0].length;

      const rulesMap = new Map();
      this.parseRuleBlocks(mediaBody, rulesMap);
      this.mediaQueries.set(condition, rulesMap);
    }
    nonMediaSegments.push(stripped.slice(lastMediaEnd));

    // Parse regular rules from non-media segments
    for (const segment of nonMediaSegments) {
      this.parseRuleBlocks(segment, this.globalRules);
    }

    // Extract :root variables
    for (const [selector, props] of this.globalRules.entries()) {
      if (selector === ':root' || selector.includes(':root')) {
        for (const [prop, val] of props.entries()) {
          if (prop.startsWith('--')) {
            this.rootVariables.set(prop, val);
          }
        }
      }
    }
  }

  parseRuleBlocks(text, targetMap) {
    const blockRegex = /([^{]+)\{([^}]+)\}/g;
    let blockMatch;
    while ((blockMatch = blockRegex.exec(text)) !== null) {
      const rawSelectors = blockMatch[1].split(',');
      const body = blockMatch[2];

      const props = new Map();
      const declarations = body.split(';');
      for (const decl of declarations) {
        const colonIdx = decl.indexOf(':');
        if (colonIdx > 0) {
          const propName = decl.slice(0, colonIdx).trim();
          const propVal = decl.slice(colonIdx + 1).trim();
          if (propName) {
            props.set(propName, propVal);
          }
        }
      }

      for (const sel of rawSelectors) {
        const s = sel.trim();
        if (!s) continue;
        if (!targetMap.has(s)) {
          targetMap.set(s, new Map());
        }
        const existing = targetMap.get(s);
        for (const [p, v] of props.entries()) {
          existing.set(p, v);
        }
      }
    }
  }

  getRootVariable(name) {
    return this.rootVariables.get(name) || null;
  }

  getProperty(selector, propName, mediaCondition = null) {
    if (mediaCondition) {
      for (const [cond, rules] of this.mediaQueries.entries()) {
        if (cond.includes(mediaCondition)) {
          if (rules.has(selector) && rules.get(selector).has(propName)) {
            return rules.get(selector).get(propName);
          }
        }
      }
      return null;
    }

    if (this.globalRules.has(selector) && this.globalRules.get(selector).has(propName)) {
      return this.globalRules.get(selector).get(propName);
    }
    return null;
  }

  hasProperty(selector, propName, value = null, mediaCondition = null) {
    const actual = this.getProperty(selector, propName, mediaCondition);
    if (actual === null) return false;
    if (value === null) return true;
    return actual.toLowerCase().includes(value.toLowerCase());
  }

  findMediaQueriesWithMax(maxPx) {
    const results = [];
    for (const cond of this.mediaQueries.keys()) {
      if (cond.includes(`max-width: ${maxPx}px`) || cond.includes(`max-width:${maxPx}px`)) {
        results.push(cond);
      }
    }
    return results;
  }

  findMediaQueriesWithMin(minPx) {
    const results = [];
    for (const cond of this.mediaQueries.keys()) {
      if (cond.includes(`min-width: ${minPx}px`) || cond.includes(`min-width:${minPx}px`)) {
        results.push(cond);
      }
    }
    return results;
  }
}

export function loadCSS(cssFilePath) {
  const content = fs.readFileSync(cssFilePath, 'utf8');
  return new ParsedCSS(content);
}
