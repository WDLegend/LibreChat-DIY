import { useMemo } from 'react';
import cn from '~/utils/cn';
import type { LearningMapPayload } from '~/types/learning';

type PositionedNode = {
  id: string;
  label: string;
  x: number;
  y: number;
};

type LearningTreeGraphProps = {
  map: LearningMapPayload;
  masteredNodeIds?: string[];
  currentNodeId?: string;
  compact?: boolean;
  className?: string;
  onNodeClick?: (nodeId: string) => void;
};

function buildLevels(map: LearningMapPayload): string[][] {
  const nodeIds = new Set(map.nodes.map((node) => node.id));
  const indegree = new Map<string, number>(map.nodes.map((node) => [node.id, 0]));
  const children = new Map<string, string[]>(map.nodes.map((node) => [node.id, []]));

  (map.edges ?? []).forEach((edge) => {
    if (!nodeIds.has(edge.from) || !nodeIds.has(edge.to)) {
      return;
    }
    children.set(edge.from, [...(children.get(edge.from) ?? []), edge.to]);
    indegree.set(edge.to, (indegree.get(edge.to) ?? 0) + 1);
  });

  const queue = map.nodes.filter((node) => (indegree.get(node.id) ?? 0) === 0).map((node) => node.id);
  const level = new Map<string, number>(queue.map((id) => [id, 0]));

  while (queue.length > 0) {
    const id = queue.shift();
    if (!id) {
      break;
    }
    const currentLevel = level.get(id) ?? 0;
    (children.get(id) ?? []).forEach((nextId) => {
      const nextLevel = Math.max(level.get(nextId) ?? 0, currentLevel + 1);
      level.set(nextId, nextLevel);
      indegree.set(nextId, (indegree.get(nextId) ?? 0) - 1);
      if ((indegree.get(nextId) ?? 0) <= 0) {
        queue.push(nextId);
      }
    });
  }

  map.nodes.forEach((node) => {
    if (!level.has(node.id)) {
      level.set(node.id, 0);
    }
  });

  const maxLevel = Math.max(...Array.from(level.values()), 0);
  const levels = Array.from({ length: maxLevel + 1 }, () => [] as string[]);
  map.nodes.forEach((node) => {
    const lv = level.get(node.id) ?? 0;
    levels[lv].push(node.id);
  });

  return levels;
}

export default function LearningTreeGraph({
  map,
  masteredNodeIds = [],
  currentNodeId,
  compact = false,
  className,
  onNodeClick,
}: LearningTreeGraphProps) {
  const layout = useMemo(() => {
    const levels = buildLevels(map);
    const nodeWidth = compact ? 116 : 170;
    const nodeHeight = compact ? 36 : 48;
    const xGap = compact ? 22 : 40;
    const yGap = compact ? 52 : 80;
    const padding = compact ? 16 : 24;

    const maxCount = Math.max(...levels.map((nodes) => nodes.length), 1);
    const width = padding * 2 + maxCount * nodeWidth + (maxCount - 1) * xGap;
    const height = padding * 2 + levels.length * nodeHeight + Math.max(levels.length - 1, 0) * yGap;

    const positions = new Map<string, PositionedNode>();
    levels.forEach((nodeIds, levelIndex) => {
      const rowWidth = nodeIds.length * nodeWidth + Math.max(nodeIds.length - 1, 0) * xGap;
      const startX = (width - rowWidth) / 2;
      const y = padding + levelIndex * (nodeHeight + yGap);
      nodeIds.forEach((id, index) => {
        const node = map.nodes.find((entry) => entry.id === id);
        if (!node) {
          return;
        }
        positions.set(id, {
          id,
          label: node.label,
          x: startX + index * (nodeWidth + xGap),
          y,
        });
      });
    });

    return {
      positions,
      width,
      height,
      nodeWidth,
      nodeHeight,
    };
  }, [compact, map]);

  const mastered = new Set(masteredNodeIds);

  return (
    <div className={cn('w-full overflow-auto rounded-md border border-border-light bg-surface-primary', className)}>
      <svg
        width="100%"
        height={layout.height}
        viewBox={`0 0 ${layout.width} ${layout.height}`}
        preserveAspectRatio="xMidYMid meet"
      >
        {(map.edges ?? []).map((edge) => {
          const from = layout.positions.get(edge.from);
          const to = layout.positions.get(edge.to);
          if (!from || !to) {
            return null;
          }
          return (
            <path
              key={`${edge.from}-${edge.to}`}
              d={`M ${from.x + layout.nodeWidth / 2} ${from.y + layout.nodeHeight} C ${from.x + layout.nodeWidth / 2} ${from.y + layout.nodeHeight + 28}, ${to.x + layout.nodeWidth / 2} ${to.y - 28}, ${to.x + layout.nodeWidth / 2} ${to.y}`}
              fill="none"
              stroke="#94a3b8"
              strokeWidth="1.5"
              strokeDasharray={mastered.has(edge.from) && mastered.has(edge.to) ? '0' : '3 3'}
              opacity="0.9"
            />
          );
        })}

        {Array.from(layout.positions.values()).map((node) => {
          const isMastered = mastered.has(node.id);
          const isCurrent = node.id === currentNodeId;
          const fill = isCurrent ? '#e0f2fe' : isMastered ? '#dcfce7' : '#f8fafc';
          const stroke = isCurrent ? '#38bdf8' : isMastered ? '#4ade80' : '#cbd5e1';
          return (
            <g
              key={node.id}
              onClick={() => onNodeClick?.(node.id)}
              className={cn(onNodeClick && 'cursor-pointer')}
            >
              <rect
                x={node.x}
                y={node.y}
                rx={10}
                ry={10}
                width={layout.nodeWidth}
                height={layout.nodeHeight}
                fill={fill}
                stroke={stroke}
                strokeWidth="1.8"
              />
              <text
                x={node.x + layout.nodeWidth / 2}
                y={node.y + layout.nodeHeight / 2 + 4}
                textAnchor="middle"
                fontSize={compact ? 11 : 13}
                fill="#0f172a"
                className="select-none"
              >
                {node.label.length > (compact ? 10 : 18)
                  ? `${node.label.slice(0, compact ? 10 : 18)}...`
                  : node.label}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}
