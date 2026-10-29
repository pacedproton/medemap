import { Menu, Item, useContextMenu } from 'react-contexify';
import 'react-contexify/dist/ReactContexify.css';

interface ContextMenuProps {
  onCopy: () => void;
  onExportCsv: () => void;
}

export default function ContextMenu({ onCopy, onExportCsv }: ContextMenuProps) {
  const { show } = useContextMenu({
    id: 'context-menu'
  });

  return (
    <Menu id="context-menu">
      <Item onClick={onCopy}>Copy CSV Table Data to Clipboard</Item>
      <Item onClick={onExportCsv}>Export Table as CSV File</Item>
    </Menu>
  );
}