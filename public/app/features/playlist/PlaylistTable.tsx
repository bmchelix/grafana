import { DragDropContext, Droppable, DropResult } from '@hello-pangea/dnd';

import { t } from '@grafana/i18n';
import { FieldSet } from '@grafana/ui';

import { PlaylistTableRows } from './PlaylistTableRows';
import { PlaylistItemUI } from './types';

interface Props {
  items: PlaylistItemUI[];
  deleteItem: (idx: number) => void;
  moveItem: (src: number, dst: number) => void;
}

export const PlaylistTable = ({ items, deleteItem, moveItem }: Props) => {
  const onDragEnd = (d: DropResult) => {
    if (d.destination) {
      moveItem(d.source.index, d.destination?.index);
    }
  };

  return (
    <>
      {/* BMC Code : Accessibility Change (Next 1 line) */}
      <FieldSet label={t('playlist-edit.form.table-heading', 'Dashboards')} role="application">
        <DragDropContext onDragEnd={onDragEnd}>
          <Droppable droppableId="playlist-list" direction="vertical">
            {(provided) => {
              return (
                <div
                  ref={provided.innerRef}
                  {...provided.droppableProps}
                  // BMC Code : Accessibility Change ( next 2 line)
                  role="list"
                  aria-label={t('playlist-edit.form.table-heading', 'Dashboards')}
                >
                  <PlaylistTableRows items={items} onDelete={deleteItem} />
                  {provided.placeholder}
                </div>
              );
            }}
          </Droppable>
        </DragDropContext>
      </FieldSet>

      {/* BMC Code : Accessibility Change (Next 5 line) */}
      <div aria-live="polite" aria-atomic="true" className="sr-only">
        {items.length > 0
          ? t('bmc.playlist.items-changed', 'Playlist items changed. There are {{count}} dashboards in playlist now.', {
              count: items.length,
            })
          : t('bmc.playlist.empty', 'Playlist is empty. Add dashboards below.')}
      </div>
    </>
  );
};
