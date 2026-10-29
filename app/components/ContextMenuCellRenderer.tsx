// tableschat/components/ContextMenuCellRenderer.tsx

import { ICellRendererComp } from 'ag-grid-community';

export class ContextMenuCellRenderer implements ICellRendererComp {
  private params: any;
  private eGui!: HTMLElement;

  constructor() {
    this.eGui = document.createElement('div');
    this.handleContextMenu = this.handleContextMenu.bind(this);
  }

  init(params: any) {
    this.params = params;
    this.eGui.innerText = params.valueFormatted ? params.valueFormatted : params.value;
    this.eGui.addEventListener('contextmenu', this.handleContextMenu);
  }

  getGui() {
    return this.eGui;
  }

  refresh(params: any): boolean {
    this.eGui.removeEventListener('contextmenu', this.handleContextMenu);
    return false;
  }

  handleContextMenu(event: MouseEvent) {
    event.preventDefault();
    event.stopPropagation();
    console.log('[debug] Cell context menu clicked');
    this.params.context.onCellContextMenu(this.params);
  }
}