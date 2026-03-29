import { useState, memo } from 'react';
import { useDefaultLayout } from 'react-resizable-panels';
import {
  ResizableHandleAlt,
  ResizablePanel,
  ResizablePanelGroup,
  useMediaQuery,
} from '@librechat/client';
import ArtifactsPanel from './ArtifactsPanel';

const PANEL_IDS_SINGLE = ['messages-view'];
const PANEL_IDS_SPLIT = ['messages-view', 'artifacts-panel'];
const PANEL_IDS_NOTES = ['messages-view', 'notes-panel'];
const PANEL_IDS_FULL = ['messages-view', 'notes-panel', 'artifacts-panel'];

interface SidePanelProps {
  artifacts?: React.ReactNode;
  notes?: React.ReactNode;
  children: React.ReactNode;
}

const SidePanelGroup = memo(({ artifacts, notes, children }: SidePanelProps) => {
  const [shouldRenderArtifacts, setShouldRenderArtifacts] = useState(artifacts != null);
  const isSmallScreen = useMediaQuery('(max-width: 767px)');
  const panelIds =
    artifacts != null && notes != null
      ? PANEL_IDS_FULL
      : artifacts != null
        ? PANEL_IDS_SPLIT
        : notes != null
          ? PANEL_IDS_NOTES
          : PANEL_IDS_SINGLE;

  const { defaultLayout, onLayoutChanged } = useDefaultLayout({
    id: 'side-panel-layout',
    panelIds,
    storage: localStorage,
  });

  const minSizeMain = artifacts != null || notes != null ? '15' : '30';

  return (
    <>
      <ResizablePanelGroup
        orientation="horizontal"
        defaultLayout={defaultLayout}
        onLayoutChanged={onLayoutChanged}
        className="relative flex-1 bg-presentation"
      >
        <ResizablePanel defaultSize="50" minSize={minSizeMain} id="messages-view">
          {children}
        </ResizablePanel>

        {!isSmallScreen && notes != null && (
          <>
            <ResizableHandleAlt withHandle className="bg-border-medium text-text-primary" />
            <ResizablePanel defaultSize="30" minSize="20" id="notes-panel">
              <div className="h-full overflow-hidden">{notes}</div>
            </ResizablePanel>
          </>
        )}

        {!isSmallScreen && (
          <ArtifactsPanel
            artifacts={artifacts}
            minSizeMain={minSizeMain}
            shouldRender={shouldRenderArtifacts}
            onRenderChange={setShouldRenderArtifacts}
          />
        )}
      </ResizablePanelGroup>
      {artifacts != null && isSmallScreen && (
        <div className="fixed inset-0 z-[100]">{artifacts}</div>
      )}
    </>
  );
});

SidePanelGroup.displayName = 'SidePanelGroup';

export default SidePanelGroup;
