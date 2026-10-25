// test/e2e/harness/dom-simulator.js
// DOM and HTML structure simulator for Chrome/Firefox Extension Popups

import fs from 'fs';
import path from 'path';

export class SimulatedElement {
  constructor(tag, attributes = {}, textContent = '', rawHtml = '') {
    this.tagName = tag.toLowerCase();
    this.attributes = attributes;
    this.id = attributes.id || '';
    this.className = attributes.class || '';
    this.classList = new Set(this.className.split(/\s+/).filter(Boolean));
    this.textContent = textContent;
    this.rawHtml = rawHtml;
    this.children = [];
    this.parentElement = null;
    this.style = {};
    this.value = attributes.value || '';
    this.checked = 'checked' in attributes;
    this.dataset = {};

    for (const [key, val] of Object.entries(attributes)) {
      if (key.startsWith('data-')) {
        const camelKey = key.slice(5).replace(/-([a-z])/g, (_, c) => c.toUpperCase());
        this.dataset[camelKey] = val;
      }
    }
  }

  getAttribute(name) {
    return this.attributes[name] !== undefined ? this.attributes[name] : null;
  }

  setAttribute(name, value) {
    this.attributes[name] = String(value);
    if (name === 'id') this.id = String(value);
    if (name === 'class') {
      this.className = String(value);
      this.classList = new Set(this.className.split(/\s+/).filter(Boolean));
    }
  }

  hasAttribute(name) {
    return this.attributes[name] !== undefined;
  }

  querySelectorAll(selector) {
    if (selector.includes(',')) {
      const parts = selector.split(',').map(p => p.trim()).filter(Boolean);
      const set = new Set();
      for (const part of parts) {
        for (const el of this.querySelectorAll(part)) {
          set.add(el);
        }
      }
      return Array.from(set);
    }

    const results = [];
    for (const child of this.children) {
      if (matchesSelector(child, selector)) {
        results.push(child);
      }
      results.push(...child.querySelectorAll(selector));
    }
    return results;
  }

  querySelector(selector) {
    if (selector.includes(',')) {
      const parts = selector.split(',').map(p => p.trim()).filter(Boolean);
      for (const part of parts) {
        const found = this.querySelector(part);
        if (found) return found;
      }
      return null;
    }

    for (const child of this.children) {
      if (matchesSelector(child, selector)) {
        return child;
      }
      const found = child.querySelector(selector);
      if (found) return found;
    }
    return null;
  }

  getElementsByClassName(cls) {
    return this.querySelectorAll(`.${cls}`);
  }

  getElementsByTagName(tag) {
    return this.querySelectorAll(tag);
  }
}

function matchesSelector(element, selector) {
  const s = selector.trim();
  if (s.startsWith('#')) {
    return element.id === s.slice(1);
  }
  if (s.startsWith('.')) {
    return element.classList.has(s.slice(1));
  }
  if (s.includes('[') && s.includes(']')) {
    const match = s.match(/([a-zA-Z0-9_\-.]*)\[([a-zA-Z0-9_\-]+)(?:=(?:"|')?([^"']*)(?:"|')?)?\]/);
    if (match) {
      const [_, baseSel, attrName, attrVal] = match;
      if (baseSel && !matchesSelector(element, baseSel)) return false;
      if (attrVal !== undefined) {
        return element.getAttribute(attrName) === attrVal;
      }
      return element.hasAttribute(attrName);
    }
  }
  return element.tagName === s.toLowerCase();
}

export class SimulatedDOM {
  constructor(htmlContent) {
    this.rawHtml = htmlContent;
    this.root = this.parse(htmlContent);
  }

  parse(html) {
    const root = new SimulatedElement('html', {}, '', html);
    const elementsById = new Map();
    const allElements = [];

    const openTags = [root];
    const tokenRegex = /<(\/)?([a-zA-Z0-9\-]+)([^>]*)>/g;
    let match;

    while ((match = tokenRegex.exec(html)) !== null) {
      const isClose = !!match[1];
      const tagName = match[2].toLowerCase();
      const rawAttrs = match[3];

      if (['meta', 'link', 'br', 'hr', 'img', 'input'].includes(tagName)) {
        const attrs = parseAttributes(rawAttrs);
        const el = new SimulatedElement(tagName, attrs);
        const parent = openTags[openTags.length - 1];
        if (parent) {
          el.parentElement = parent;
          parent.children.push(el);
        }
        if (el.id) elementsById.set(el.id, el);
        allElements.push(el);
        continue;
      }

      if (isClose) {
        if (openTags.length > 1) {
          openTags.pop();
        }
      } else {
        const attrs = parseAttributes(rawAttrs);
        const el = new SimulatedElement(tagName, attrs);
        const parent = openTags[openTags.length - 1];
        if (parent) {
          el.parentElement = parent;
          parent.children.push(el);
        }
        if (el.id) elementsById.set(el.id, el);
        allElements.push(el);
        openTags.push(el);
      }
    }

    this.elementsById = elementsById;
    this.allElements = allElements;
    return root;
  }

  getElementById(id) {
    return this.elementsById.get(id) || null;
  }

  querySelector(selector) {
    if (selector.startsWith('#') && !selector.includes(' ') && !selector.includes('.') && !selector.includes(',')) {
      return this.getElementById(selector.slice(1));
    }
    return this.root.querySelector(selector);
  }

  querySelectorAll(selector) {
    return this.root.querySelectorAll(selector);
  }
}

function parseAttributes(rawAttrs) {
  const attrs = {};
  if (!rawAttrs) return attrs;
  const attrRegex = /([a-zA-Z0-9\-]+)(?:=(?:"([^"]*)"|'([^']*)'|([^\s>]+)))?/g;
  let match;
  while ((match = attrRegex.exec(rawAttrs)) !== null) {
    const key = match[1];
    const val = match[2] !== undefined ? match[2] : (match[3] !== undefined ? match[3] : (match[4] !== undefined ? match[4] : ''));
    attrs[key] = val;
  }
  return attrs;
}

export function loadPopupDOM(popupHtmlPath) {
  const content = fs.readFileSync(popupHtmlPath, 'utf8');
  return new SimulatedDOM(content);
}
