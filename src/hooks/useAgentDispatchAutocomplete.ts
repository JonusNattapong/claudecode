/**
 * useAgentDispatchAutocomplete — Autocomplete hook for agent view dispatch input.
 * Provides suggestions for @agent, /skill, #PR, a:filter, s:state syntax.
 */

import * as React from 'react';

export type DispatchAutocompleteSuggestion = {
  text: string;
  description: string;
  type: 'agent' | 'skill' | 'pr' | 'agent-filter' | 'state-filter';
};

type AutocompleteState = {
  suggestions: DispatchAutocompleteSuggestion[];
  selectedIndex: number;
  /** The prefix that triggered autocomplete (e.g., "@", "/", "#", "a:", "s:") */
  prefix: string;
  /** The partial text after the prefix that we're matching against */
  partial: string;
  /** Start position of the prefix in the input */
  startPos: number;
};

type AutocompleteSources = {
  agents?: Array<{ agentType?: string; name?: string; description?: string }>;
  skills?: Array<{ name: string; description?: string }>;
  prNumbers?: number[];
  agentNames?: string[];
};

const STATE_OPTIONS = [
  { text: 'blocked', description: 'Sessions waiting for input or permission' },
  { text: 'running', description: 'Sessions currently working' },
  { text: 'completed', description: 'Sessions that finished successfully' },
  { text: 'failed', description: 'Sessions that encountered errors' },
  { text: 'stopped', description: 'Sessions that were stopped' },
];

function findPrefix(input: string, cursorOffset: number): { prefix: string; partial: string; startPos: number } | null {
  const beforeCursor = input.slice(0, cursorOffset);

  // Match patterns at the end of beforeCursor
  const patterns: Array<{ regex: RegExp; prefix: string }> = [
    { regex: /@([\w-]*)$/, prefix: '@' },
    { regex: /\/([\w-]*)$/, prefix: '/' },
    { regex: /#(\d*)$/, prefix: '#' },
    { regex: /a:([\w-]*)$/, prefix: 'a:' },
    { regex: /s:([\w-]*)$/, prefix: 's:' },
  ];

  for (const { regex, prefix } of patterns) {
    const match = beforeCursor.match(regex);
    if (match) {
      return {
        prefix,
        partial: match[1] ?? '',
        startPos: match.index! + 1, // position after the prefix start
      };
    }
  }

  return null;
}

function getSuggestionsForPrefix(
  prefix: string,
  partial: string,
  sources: AutocompleteSources,
): DispatchAutocompleteSuggestion[] {
  const lowerPartial = partial.toLowerCase();

  switch (prefix) {
    case '@': {
      const items = (sources.agents ?? []).map(a => ({
        text: a.name ?? a.agentType ?? '',
        description: a.description ?? `Agent: ${a.agentType ?? ''}`,
        type: 'agent' as const,
      }));
      if (!lowerPartial) return items.slice(0, 10);
      return items.filter(item => item.text.toLowerCase().includes(lowerPartial)).slice(0, 10);
    }

    case '/': {
      const items = (sources.skills ?? []).map(s => ({
        text: s.name,
        description: s.description ?? '',
        type: 'skill' as const,
      }));
      if (!lowerPartial) return items.slice(0, 10);
      return items.filter(item => item.text.toLowerCase().includes(lowerPartial)).slice(0, 10);
    }

    case '#': {
      const items = (sources.prNumbers ?? []).map(n => ({
        text: String(n),
        description: `PR #${n}`,
        type: 'pr' as const,
      }));
      if (!lowerPartial) return items.slice(0, 10);
      return items.filter(item => item.text.includes(lowerPartial)).slice(0, 10);
    }

    case 'a:': {
      const items = (sources.agentNames ?? sources.agents ?? []).map(a => {
        const name = typeof a === 'string' ? a : (a.name ?? a.agentType ?? '');
        return {
          text: name,
          description: `Filter by agent: ${name}`,
          type: 'agent-filter' as const,
        };
      });
      if (!lowerPartial) return items.slice(0, 10);
      return items.filter(item => item.text.toLowerCase().includes(lowerPartial)).slice(0, 10);
    }

    case 's:': {
      const items = STATE_OPTIONS.map(s => ({
        text: s.text,
        description: s.description,
        type: 'state-filter' as const,
      }));
      if (!lowerPartial) return items.slice(0, 10);
      return items.filter(item => item.text.includes(lowerPartial)).slice(0, 10);
    }

    default:
      return [];
  }
}

export function useAgentDispatchAutocomplete(
  input: string,
  cursorOffset: number,
  sources: AutocompleteSources,
): AutocompleteState & {
  accept: (input: string, cursorOffset: number) => { text: string; offset: number } | null;
  setSelectedIndex: React.Dispatch<React.SetStateAction<number>>;
} {
  const [selectedIndex, setSelectedIndex] = React.useState(0);
  const selectedIndexRef = React.useRef(selectedIndex);

  // Keep ref in sync
  React.useEffect(() => {
    selectedIndexRef.current = selectedIndex;
  }, [selectedIndex]);

  const prefixInfo = React.useMemo(() => findPrefix(input, cursorOffset), [input, cursorOffset]);

  const suggestionsRef = React.useRef<DispatchAutocompleteSuggestion[]>([]);
  const suggestions = React.useMemo(() => {
    if (!prefixInfo) return [];
    const result = getSuggestionsForPrefix(prefixInfo.prefix, prefixInfo.partial, sources);
    suggestionsRef.current = result;
    return result;
  }, [prefixInfo, sources]);

  // Clamp selected index when suggestions change
  React.useEffect(() => {
    if (selectedIndex >= suggestions.length) {
      setSelectedIndex(Math.max(0, suggestions.length - 1));
    }
  }, [suggestions.length, selectedIndex]);

  const accept = React.useCallback(
    (currentInput: string, currentOffset: number): { text: string; offset: number } | null => {
      const info = findPrefix(currentInput, currentOffset);
      const currentSuggestions = suggestionsRef.current;
      const currentIndex = selectedIndexRef.current;
      if (!info || currentSuggestions.length === 0) return null;

      const suggestion = currentSuggestions[currentIndex >= 0 ? currentIndex : 0];
      if (!suggestion) return null;

      // Replace from prefix start to cursor with the suggestion text
      const beforePrefix = currentInput.slice(0, info.startPos - info.prefix.length);
      const afterCursor = currentInput.slice(currentOffset);

      let replacement: string;
      if (info.prefix === '#') {
        replacement = `#${suggestion.text}`;
      } else {
        replacement = `${info.prefix}${suggestion.text} `;
      }

      const newText = beforePrefix + replacement + afterCursor;
      const newOffset = beforePrefix.length + replacement.length;
      return { text: newText, offset: newOffset };
    },
    [], // no deps needed — uses refs
  );

  return {
    suggestions,
    selectedIndex,
    setSelectedIndex,
    prefix: prefixInfo?.prefix ?? '',
    partial: prefixInfo?.partial ?? '',
    startPos: prefixInfo?.startPos ?? 0,
    accept,
  };
}
