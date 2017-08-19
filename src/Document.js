import AddDeleteDocElementCmd from './commands/AddDeleteDocElementCmd';
import DocumentProperties from './data/DocumentProperties';
import DocElement from './elements/DocElement';
import * as utils from './utils';

export default class Document {
    constructor(rootElement, showGrid, rb) {
        this.rootElement = rootElement;
        this.rb = rb;
        this.elDocContent = null;
        this.elHeader = null;
        this.elContent = null;
        this.elFooter = null;
        this.gridVisible = showGrid;
        this.gridSize = 10;
        this.pdfPreviewExists = false;

        // moving/resizing of element
        this.dragging = false;
        this.dragElementType = null;
        this.dragType = DocElement.dragType.none;
        this.dragContainer = null;
        this.dragCurrentContainer = null;
        this.dragStartX = 0;
        this.dragStartY = 0;
        this.dragCurrentX = 0;
        this.dragCurrentY = 0;
        this.dragSnapToGrid = false;
        this.dragEnterCount = 0;
    }

    render() {
        let panel = $('#rbro_document_panel')
            .mousedown(event => {
                if (this.rb.isDocElementSelected()) {
                    this.rb.deselectAll();
                }
            });

        let elDocTabs = $('<div id="rbro_document_tabs" class="rbroDocumentTabs"></div>')
            .mousedown(event => {
                // avoid deselection of doc elements when clicking document tab
                event.stopPropagation();
            });

        elDocTabs.append(
            $(`<div id="rbro_document_tab_pdf_layout" class="rbroDocumentTab rbroButton rbroTabButton">
               ${this.rb.getLabel('documentTabPdfLayout')}</div>`)
            .click(event => {
                this.setDocumentTab(Document.tab.pdfLayout);
            }));
        let btnPdfPreview = $(
            `<div id="rbro_document_tab_pdf_preview" class="rbroDocumentTab rbroButton rbroTabButton rbroHidden rbroPdfPreview 
                ${this.rb.getProperty('enableSpreadsheet') ? 'rbroXlsxDownload' : ''}">
                ${this.rb.getLabel('documentTabPdfPreview')}</div>`)
            .click(event => {
                this.setDocumentTab(Document.tab.pdfPreview);
            });
        if (this.rb.getProperty('enableSpreadsheet')) {
            btnPdfPreview.append($(
                `<span class="rbroIcon-xlsx rbroXlsxDownlaodButton" title="${this.rb.getLabel('documentTabXlsxDownload')}"></span>`)
                .click(event => { this.rb.downloadSpreadsheet(); }));
        }
        btnPdfPreview.append($(
            `<span class="rbroIcon-cancel" title="${this.rb.getLabel('documentTabClose')}"></span>`)
            .click(event => { this.closePdfPreviewTab(); }));
        elDocTabs.append(btnPdfPreview);
        panel.append(elDocTabs);

        let elDoc = $('<div id="rbro_document_pdf" class="rbroDocument rbroDragTarget rbroHidden"></div>');
        let docProperties = this.rb.getDocumentProperties();
        this.elDocContent = $(`<div id="rbro_document_content"
            class="rbroDocumentContent ${this.gridVisible ? 'rbroDocumentGrid' : ''}"></div>`);
        this.elHeader = $('<div id="rbro_header" class="rbroDocumentBand" style="top: 0px; left: 0px;"></div>');
        this.elHeader.append($(`<div class="rbroDocumentBandDescription">${this.rb.getLabel('bandHeader')}</div>`));
        this.elDocContent.append(this.elHeader);
        this.elContent = $('<div id="rbro_content" class="rbroDocumentBand"></div>');
        this.elContent.append($(`<div class="rbroDocumentBandDescription">${this.rb.getLabel('bandContent')}</div>`));
        this.elDocContent.append(this.elContent);
        this.elFooter = $('<div id="rbro_footer" class="rbroDocumentBand" style="bottom: 0px; left 0px;"></div>');
        this.elFooter.append($(`<div class="rbroDocumentBandDescription">${this.rb.getLabel('bandFooter')}</div>`));
        this.elDocContent.append(this.elFooter);
        elDoc.append(this.elDocContent);

        this.initializeEventHandlers();

        elDoc.append('<div id="rbro_divider_margin_left" class="rbroDivider rbroDividerMarginLeft"></div>');
        elDoc.append('<div id="rbro_divider_margin_top" class="rbroDivider rbroDividerMarginTop"></div>');
        elDoc.append('<div id="rbro_divider_margin_right" class="rbroDivider rbroDividerMarginRight"></div>');
        elDoc.append('<div id="rbro_divider_margin_bottom" class="rbroDivider rbroDividerMarginBottom"></div>');
        elDoc.append('<div id="rbro_divider_header" class="rbroDivider rbroDividerHeader"></div>');
        elDoc.append('<div id="rbro_divider_footer" class="rbroDivider rbroDividerFooter"></div>');
        panel.append(elDoc);

        panel.append($('<div id="rbro_document_pdf_preview" class="rbroDocumentPreview"></div>'));

        let size = docProperties.getPageSize();
        this.updatePageSize(size.width, size.height);
        this.updateHeader();
        this.updateFooter();
        this.updatePageMargins();
        this.updateDocumentTabs();

        this.setDocumentTab(Document.tab.pdfLayout);
    }

    initializeEventHandlers() {
        $('#rbro_document_panel').mousemove(event => {
            if (this.dragging) {
                if (this.dragType === DocElement.dragType.element) {
                    let container = this.getContainer(event.originalEvent.pageX, event.originalEvent.pageY);
                    if (container !== this.dragCurrentContainer) {
                        $('.rbroDocumentBand').removeClass('rbroElementDragOver');
                        if (container !== null && container !== this.dragContainer) {
                            container.dragOver(this.dragElementType);
                        }
                    }
                    this.dragCurrentContainer = container;
                }
                this.dragCurrentX = event.originalEvent.pageX;
                this.dragCurrentY = event.originalEvent.pageY;
                this.dragSnapToGrid = !event.ctrlKey;
                this.rb.updateSelectionDrag(event.originalEvent.pageX - this.dragStartX, event.originalEvent.pageY - this.dragStartY,
                    this.dragType, null, this.dragSnapToGrid, false);
            }
        });
        this.elDocContent.on('dragover', event => {
            if (this.rb.isBrowserDragActive('docElement')) {
                let container = this.getContainer(event.originalEvent.pageX, event.originalEvent.pageY);
                if (container !== this.dragContainer) {
                    $('.rbroDocumentBand').removeClass('rbroElementDragOver');
                    if (container !== null) {
                        container.dragOver(this.dragElementType);
                    }
                    this.dragContainer = container;
                }
                // without preventDefault for dragover event, the drop event is not fired
                event.preventDefault();
                event.stopPropagation();
            }
        })
        .on('dragenter', event => {
            if (this.rb.isBrowserDragActive('docElement')) {
                this.dragEnterCount++;
                event.preventDefault(); // needed for IE
            }
        })
        .on('dragleave', event => {
            if (this.rb.isBrowserDragActive('docElement')) {
                this.dragEnterCount--;
                if (this.dragEnterCount === 0) {
                    $('.rbroDocumentBand').removeClass('rbroElementDragOver');
                    this.dragContainer = null;
                }
            }
        })
        .on('drop', event => {
            if (this.rb.isBrowserDragActive('docElement')) {
                $('.rbroDocumentBand').removeClass('rbroElementDragOver');
                let docProperties = this.rb.getDocumentProperties();
                let container = this.getContainer(event.originalEvent.pageX, event.originalEvent.pageY);
                if (container !== null && container.isElementAllowed(this.dragElementType)) {
                    let offset = this.elDocContent.offset();
                    let x = event.originalEvent.pageX - offset.left;
                    let y = event.originalEvent.pageY - offset.top;
                    let containerOffset = container.getOffset();
                    x -= containerOffset.x;
                    y -= containerOffset.y;
                    if (!event.ctrlKey && this.rb.getDocument().isGridVisible()) {
                        let gridSize = this.rb.getDocument().getGridSize();
                        x = utils.roundValueToInterval(x, gridSize);
                        y = utils.roundValueToInterval(y, gridSize);
                    }
                    let initialData = { x: '' + x, y: '' + y, containerId: container.getId() };
                    let cmd = new AddDeleteDocElementCmd(true, this.dragElementType, initialData,
                        this.rb.getUniqueId(), container.getId(), -1, this.rb);
                    this.rb.executeCommand(cmd);
                }
                event.preventDefault();
                return false;
            }
        });
    }

    updatePageSize(width, height) {
        $('#rbro_document_pdf').css({ width: this.rb.toPixel(width), height: this.rb.toPixel(height) });
    }

    updatePageMargins() {
        let docProperties = this.rb.getDocumentProperties();
        let left = this.rb.toPixel(utils.convertInputToNumber(docProperties.getValue('marginLeft')) - 1);
        let top = this.rb.toPixel(utils.convertInputToNumber(docProperties.getValue('marginTop')) - 1);
        let marginRight = utils.convertInputToNumber(docProperties.getValue('marginRight'));
        let marginBottom = utils.convertInputToNumber(docProperties.getValue('marginBottom'));
        let right = this.rb.toPixel(marginRight);
        let bottom = this.rb.toPixel(marginBottom);
        $('#rbro_divider_margin_left').css('left', left);
        $('#rbro_divider_margin_top').css('top', top);
        // hide right/bottom divider in case margin is 0, otherwise divider is still visible
        // because it is one pixel to the left/top of document border
        if (marginRight !== 0) {
            $('#rbro_divider_margin_right').css('right', right).show();
        } else {
            $('#rbro_divider_margin_right').hide();
        }
        if (marginBottom !== 0) {
            $('#rbro_divider_margin_bottom').css('bottom', bottom).show();
        } else {
            $('#rbro_divider_margin_bottom').hide();
        }
        this.elDocContent.css({ left: left, top: top, right: right, bottom: bottom });
    }

    updateHeader() {
        let docProperties = this.rb.getDocumentProperties();
        if (docProperties.getValue('header')) {
            let headerSize = this.rb.toPixel(docProperties.getValue('headerSize'));
            this.elHeader.css('height', headerSize);
            this.elHeader.show();
            $('#rbro_divider_header').css('top', this.rb.toPixel(
                utils.convertInputToNumber(docProperties.getValue('marginTop')) +
                utils.convertInputToNumber(docProperties.getValue('headerSize')) - 1));
            $('#rbro_divider_header').show();
            this.elContent.css('top', headerSize);
        } else {
            this.elHeader.hide();
            $('#rbro_divider_header').hide();
            this.elContent.css('top', this.rb.toPixel(0));
        }
    }

    updateFooter() {
        let docProperties = this.rb.getDocumentProperties();
        if (docProperties.getValue('footer')) {
            let footerSize = this.rb.toPixel(docProperties.getValue('footerSize'));
            this.elFooter.css('height', footerSize);
            this.elFooter.show();
            $('#rbro_divider_footer').css('bottom', this.rb.toPixel(
                utils.convertInputToNumber(docProperties.getValue('marginBottom')) +
                utils.convertInputToNumber(docProperties.getValue('footerSize'))));
            $('#rbro_divider_footer').show();
            this.elContent.css('bottom', footerSize);
        } else {
            this.elFooter.hide();
            $('#rbro_divider_footer').hide();
            this.elContent.css('bottom', this.rb.toPixel(0));
        }
    }

    setDocumentTab(tab) {
        $('#rbro_document_tabs .rbroDocumentTab').removeClass('rbroActive');
        // use z-index to show pdf preview instead of show/hide of div because otherwise pdf is reloaded (and generated) again
        if (tab === Document.tab.pdfLayout) {
            $('#rbro_document_tab_pdf_layout').addClass('rbroActive');
            $('#rbro_document_pdf').removeClass('rbroHidden');
            $('#rbro_document_pdf_preview').css('z-index', '');
        } else if (this.pdfPreviewExists && tab === Document.tab.pdfPreview) {
            $('#rbro_document_tab_pdf_preview').addClass('rbroActive');
            $('#rbro_document_pdf').addClass('rbroHidden');
            $('#rbro_document_pdf_preview').css('z-index', '1');
        }
    }

    openPdfPreviewTab(reportUrl) {
        let pdfObj = '<object data="' + reportUrl + '" type="application/pdf" width="100%" height="100%"></object>';
        this.pdfPreviewExists = true;
        $('#rbro_document_pdf_preview').empty();
        $('#rbro_document_pdf_preview').append(pdfObj);
        this.setDocumentTab(Document.tab.pdfPreview);
        this.updateDocumentTabs();
    }

    closePdfPreviewTab() {
        this.pdfPreviewExists = false;
        $('#rbro_document_pdf_preview').empty();
        this.setDocumentTab(Document.tab.pdfLayout);
        this.updateDocumentTabs();
    }

    updateDocumentTabs() {
        let tabCount = 1;
        if (this.pdfPreviewExists) {
            $('#rbro_document_tab_pdf_preview').removeClass('rbroHidden');
            tabCount++;
        } else {
            $('#rbro_document_tab_pdf_preview').addClass('rbroHidden');
        }
        if (tabCount > 1) {
            $('#rbro_document_tabs').show();
            $('#rbro_document_panel').addClass('rbroHasTabs');
        } else {
            $('#rbro_document_tabs').hide();
            $('#rbro_document_panel').removeClass('rbroHasTabs');
        }
    }

    getContainer(absPosX, absPosY) {
        let offset = this.elDocContent.offset();
        return this.rb.getContainer(absPosX - offset.left, absPosY - offset.top);
    }

    isGridVisible() {
        return this.gridVisible;
    }

    toggleGrid() {
        this.gridVisible = !this.gridVisible;
        if (this.gridVisible) {
            this.elDocContent.addClass('rbroDocumentGrid');
        } else {
            this.elDocContent.removeClass('rbroDocumentGrid');
        }
    }

    getGridSize() {
        return this.gridSize;
    }

    getHeight() {
        return this.elDocContent.height();
    }

    getElement(band) {
        if (band === Document.band.header) {
            return this.elHeader;
        } else if (band === Document.band.content) {
            return this.elContent;
        } else if (band === Document.band.footer) {
            return this.elFooter;
        }
        return null;
    }

    isDragging() {
        return this.dragging;
    }

    isDragged() {
        return this.dragging && ((this.dragStartX !== this.dragCurrentX) || (this.dragStartY !== this.dragCurrentY));
    }

    startDrag(x, y, container, elementType, dragType) {
        this.dragging = true;
        this.dragStartX = this.dragCurrentX = x;
        this.dragStartY = this.dragCurrentY = y;
        this.dragElementType = elementType;
        this.dragType = dragType;
        this.dragContainer = container;
        this.dragCurrentContainer = null;
        this.dragSnapToGrid = false;
    }

    stopDrag() {
        let diffX = this.dragCurrentX - this.dragStartX;
        let diffY = this.dragCurrentY - this.dragStartY;
        if (diffX !== 0 || diffY !== 0) {
            let container = (this.dragType === DocElement.dragType.element) ? this.dragCurrentContainer : null;
            this.rb.updateSelectionDrag(diffX, diffY, this.dragType, container, this.dragSnapToGrid, true);
        } else {
            this.rb.updateSelectionDrag(0, 0, this.dragType, null, this.dragSnapToGrid, false);
        }
        this.dragging = false;
        this.dragType = DocElement.dragType.none;
        this.dragContainer = this.dragCurrentContainer = null;
        $('.rbroDocumentBand').removeClass('rbroElementDragOver');
    }

    startBrowserDrag(dragElementType) {
        this.dragEnterCount = 0;
        this.dragContainer = null;
        this.dragElementType = dragElementType;
    }
}

Document.band = {
    none: -1,
    header: 1,
    content: 2,
    footer: 3
};

Document.tab = {
    pdfLayout: 'pdfLayout',
    pdfPreview: 'pdfPreview'
};
