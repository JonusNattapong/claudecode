import * as React from 'react';
import { Box } from '../../ink.js';
import { useAppState } from '../../state/AppState.js';
import { AGENT_COLOR_TO_THEME_COLOR, AGENT_COLORS } from '../../tools/AgentTool/agentColorManager.js';
import { Divider } from '../design-system/Divider.js';
import type { FeedConfig } from './Feed.js';
import { calculateFeedWidth, Feed } from './Feed.js';

type FeedColumnProps = {
  feeds: FeedConfig[];
  maxWidth: number;
};

export function FeedColumn({ feeds, maxWidth }: FeedColumnProps): React.ReactNode {
  const feedWidths = feeds.map(feed => calculateFeedWidth(feed));
  const maxOfAllFeeds = Math.max(...feedWidths);
  const actualWidth = Math.min(maxOfAllFeeds, maxWidth);

  const standaloneAgentContext = useAppState(s => s.standaloneAgentContext);
  const standaloneColor = standaloneAgentContext?.color;
  const activeColor =
    standaloneColor && AGENT_COLORS.includes(standaloneColor)
      ? AGENT_COLOR_TO_THEME_COLOR[standaloneColor]
      : 'autoAccept';

  return (
    <Box flexDirection="column">
      {feeds.map((feed, index) => (
        <React.Fragment key={index}>
          <Feed config={feed} actualWidth={actualWidth} />
          {index < feeds.length - 1 && <Divider color={activeColor} width={actualWidth} />}
        </React.Fragment>
      ))}
    </Box>
  );
}
