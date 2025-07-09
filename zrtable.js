class ZrTable {
    /**
     * Constructor de la clase ZrTable
     * @param {string} containerId - ID del contenedor donde se renderizará la tabla.
     * @param {Object[]} data - Datos para la tabla (array de objetos).
     * @param {Object} options - Opciones de configuración (paginación, filtros, etc.).
     */
    constructor(containerId, data, options = {}) {
        this.container = document.getElementById(containerId);
        this.eFilterType = {
            Column: 'column',
            Single: 'single',
            SingleColumn: 'singleColumn',
            SingleColumnMultiple: 'singleColumnMultiple'
        };
        this.eCaptionAlign = {
            Top: 'top',
            Bottom: 'bottom',
        };
        this.eSortDirection = {
            Asc: 'asc',
            Desc: 'desc',
        };
        this.eSideAction = {
            Server: 'server',
            Client: 'client',
        };
        this.eColumnType = {
            Text: 'text',
            Number: 'number',
            Decimal: 'decimal',
            Date: 'date',
            DateTime: 'dateTime',
            Select: 'select',
        };
        this.options = {
            pagination: options.pagination || true,
            pageSize: options.pageSize || 10,
            colSpan: options.colSpan || undefined,
            pageList: options.pageList || [10, 25, 50, 100, 'All'],
            filter: options.filter || true,
            filterType: this.validateEnum('filterType', options.filterType, this.eFilterType, this.eFilterType.Single),
            sortable: options.sortable || true,
            selectable: options.selectable || false,
            multipleSelect: options.multipleSelect || true,
            caption: options.caption,
            captionAlign: this.validateEnum('captionAlign', options.captionAlign, this.eCaptionAlign, this.eCaptionAlign.Top),
            sideActions: this.validateEnum('sideActions', options.sideActions, this.eSideAction, this.eSideAction.Client),

            fechUrl:
            {
                url: options.fechUrl?.url,
                urlUpdate: options.fechUrl?.urlUpdate,
                urlInsert: options.fechUrl?.urlInsert,
                urlDelete: options.fechUrl?.urlDelete,
                queryParams: options.fechUrl?.queryParams || {},
            },

            actionsButtons: {
                addEditBtnTbody: options.actionsButtons?.addEditBtnTbody || false,
                addDeleteBtnTbody: options.actionsButtons?.addDeleteBtnTbody || false,
                fixedBtn: options.actionsButtons?.fixedBtn || false,

                addNewBtn: options.actionsButtons?.addNewBtn || false,
                addDeleteSelect: options.actionsButtons?.addDeleteSelect || false,
                autoGenerateBtnDowload: options.actionsButtons?.autoGenerateBtnDowload || false,
                modalBoostrapCol: options.actionsButtons?.modalBoostrapCol ?? undefined,
                hiddenColumns: options.actionsButtons?.hiddenColumns || false,
            },

            exportData:
            {
                exportCSV: options.exportData?.exportCSV || false,
                delimiterCaracter: options.exportData?.delimiterCaracter || ';',
                fileName: options.exportData?.fileName || 'exportacion',
                dowloadFilterData: options.exportData?.dowloadFilterData || false,
            },

            columns: Array.isArray(options.columns) ? options.columns : [],
            autoGenerateColums: options.autoGenerateColums || true,
            isBoostrapSm: options.isBoostrapSm || false,
            ...options
        };

        this.elements = {
            table: this.container.querySelector('table') || document.createElement('table'),
            thead: this.container.querySelector('table thead') || document.createElement('thead'),
            tbody: this.container.querySelector('table tbody') || document.createElement('tbody'),
            tfoot: this.container.querySelector('table tfoot') || document.createElement('tfoot'),
        };

        this.columns = Array.isArray(options.columns)
            ? options.columns
                .filter(col => col && typeof col.dataField === 'string')
                .map(col => ({
                    dataField: col.dataField,
                    headerText: col.headerText || col.dataField || '',
                    columnType: this.validateEnum('columnType', col.columnType, this.eColumnType, this.eColumnType.Text),
                    columnOrder: col.columnOrder || 0,
                    dataFormatString: col.dataFormatString,
                    enableUpdate: col.enableUpdate || true,
                    updateControlId: col.updateControlId,
                    template: col.template,
                    templateHeader: col.templateHeader,
                    toolTip: col.toolTip,
                    visible: col.visible || true,
                    sorteable: col.sorteable || true,
                    filtrable: col.filtrable || true,
                    modalBoostrapCol: col.modalBoostrapCol || this.options.actionsButtons.modalBoostrapCol || 'auto',
                    ...col,
                }))
            : [];

        this.colSpan = 1;
        this.currentPage = 1;
        this.lastPageSize = null;
        this.sortColumn = null;
        this.sortDirection = this.eSortDirection.Asc;
        this.selectedRows = new Set();
        this.filterDiccionary = new Map();
        this.filterValue = '';
        this.filteredData = [];
        this.serverTotalRows = 0;
        this.isInit = false;
        this.needReRenderPagination = this.options.pagination;
        this._eventTarget = new EventTarget();

        // Método debounce
        this.debouncedHandleFilterChange = this.debounce(this.filterAllData.bind(this), 800);
        this.debouncedHandleFilterChangeMultiple = this.debounce(this.ChangeFilterMultiple.bind(this), 800);

        // Verificar si data es una URL (string que comienza con http:// o https://)
        if (typeof this.options.fechUrl.url === 'string') {
            this.init();
        } else if (typeof data === 'object' && data !== null && Array.isArray(data)) {
            // Asumimos que es un objeto directamente usable
            this.data = data;
            this.filteredData = [...data];
            this.init();
        } else {
            console.error('El dato proporcionado no es válido. Se esperaba una URL, un array.');
            // Opcional: asignar valores por defecto
            this.data = {};
            this.filteredData = [];
            this.isInit = true;
        }
    }

    emit(eventName, detail = {}) {
        const event = new CustomEvent(eventName, { detail });
        this._eventTarget.dispatchEvent(event);
    }

    on(eventName, callback) {
        this._eventTarget.addEventListener(eventName, callback);
    }

    debounce(func, delay) {
        let timer;
        return function (...args) {
            clearTimeout(timer);
            timer = setTimeout(() => {
                func.apply(this, args);
            }, delay);
        };
    }

    /** Inicializa la tabla */
    init() {
        if (!this.container) {
            this.isInit = true;
            console.error(`Contenedor con ID "${this.containerId}" no encontrado.`);
            return;
        }

        // Trae los datos
        this.handleDataChange();
        this.emit('tableInit', { init: true });
    }

    handleDataChange() {
        if (this.elements.table.dataset.initializeTable !== 'True') this.appendTable();
        this.renderLoader();
        if ((!this.isInit || this.options.sideActions === this.eSideAction.Server) && this.options.fechUrl.url) {
            this.loadDataFromUrl().then(() => {
                if (!this.isInit) {
                    this.isInit = true;
                    if (this.container.dataset.initializeColumns !== 'True') this.initializeColumnsFromData();
                    this.updateColSpan();
                    this.renderTable();
                } else {
                    this.renderTbody();
                    if (this.options.pagination) this.renderPagination();
                }
                this.hiddenLoader();

            }).catch(error => {
                console.error('Error al renderizar la tabla:', error);
            });
        } else {
            if (!this.isInit) {
                this.isInit = true;
                if (this.container.dataset.initializeColumns !== 'True') this.initializeColumnsFromData();
                this.updateColSpan();
                this.renderTable();
            } else {
                this.renderTbody();
                if (this.needReRenderPagination) this.renderPagination();
            }

            this.hiddenLoader();
        }
    }

    /** Renderiza la tabla */
    renderTable() {
        this.renderToobar();
        this.renderThead();
        this.renderTbody();
        this.renderTfoot();
        if (this.options.pagination) this.renderPagination();
    }

    appendTable() {
        let tableResponsive = this.container.querySelector('[data-part="body"]');
        if (!tableResponsive) tableResponsive = document.createElement('div');
        tableResponsive.className = 'table-responsive mb-3';
        tableResponsive.dataset.part = 'body';

        this.elements.table.className = 'table table-hover mb-0';
        if (this.options.selectable) this.elements.table.classList.add('selectable');
        if (this.options.isBoostrapSm) this.elements.table.classList.add('table-sm');

        this.elements.table.appendChild(this.elements.thead);
        this.elements.table.appendChild(this.elements.tbody);
        //this.elements.table.appendChild(this.elements.tfoot);
        this.elements.table.dataset.initializeTable = 'True';

        tableResponsive.appendChild(this.elements.table);
        this.container.appendChild(tableResponsive);
    }

    renderThead() {
        // Cabecera de la tabla
        const thead = this.elements.thead;
        const headerRow = document.createElement('tr');
        headerRow.className = 'table-CTR';
        if (this.options.selectable && this.options.multipleSelect) {
            const th = document.createElement('th');
            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.className = 'form-check-input';
            checkbox.dataset.selectAll = 'true';
            checkbox.title = 'Seleccionar todos';
            checkbox.addEventListener('change', (e) => this.toggleSelectAll(e));
            th.appendChild(checkbox);
            headerRow.appendChild(th);
        } else if (this.options.selectable && !this.options.multipleSelect) {
            const th = document.createElement('th');
            th.title = 'Seleccionar';
            headerRow.appendChild(th);
        }

        // Genera las columnas basadas en las keys del primer objeto
        if (this.data && this.data.length > 0) {
            this.columns.filter(col => col.visible).forEach((column, id) => {
                const th = document.createElement('th');

                if (this.options.filter && this.options.filterType === this.eFilterType.Column) {
                    const inputId = `${this.container.id}_input_sort_${id}`;

                    if (this.options.sortable && column.sorteable) {
                        // Btn
                        const btn = document.createElement('button');
                        btn.type = 'button';
                        btn.className = 'btn-sort align-self-start mb-1';
                        btn.title = column.toolTip || `Ordenar por ${column.dataField}`;
                        btn.setAttribute('aria-label', btn.title);
                        btn.textContent = column.headerText;
                        btn.addEventListener('click', () => this.sortData(column.dataField));

                        th.appendChild(btn);
                    } else if (column.filtrable) {
                        // Label
                        const lb = document.createElement('label');
                        lb.setAttribute('for', inputId);
                        lb.className = 'mb-1';
                        lb.innerText = column.headerText;
                        lb.title = column.toolTip || column.dataField;

                        th.appendChild(lb);
                    } else {
                        th.textContent = column.headerText;
                        if (column.toolTip) th.title = column.toolTip;
                    }

                    if (!column.templateHeader && column.filtrable) {
                        // input
                        const input = document.createElement('input');
                        input.autocomplete = 'off';
                        input.type = this.getInputType(column.columnType);
                        input.id = inputId;
                        input.placeholder = `Filtrar por ${column.headerText.toLowerCase()}`;
                        input.title = column.toolTip || `Filtrar por ${column.dataField}`;
                        input.className = 'form-control w-auto';
                        if (this.options.isBoostrapSm) input.classList.add('form-control-sm');

                        if (this.options.sortable) input.setAttribute('aria-label', input.title);

                        input.addEventListener('input', (e) => {
                            this.debouncedHandleFilterChangeMultiple(column.dataField, e.target.value.trim());
                            e.target.focus();
                        });

                        th.appendChild(input);
                    } else if (typeof column.templateHeader === 'function') {
                        th.appendChild(column.templateHeader(column));
                    }

                } else if (this.options.sortable && column.sorteable) {
                    const btn = document.createElement('button');
                    btn.type = 'button';
                    btn.className = 'btn-sort';
                    btn.title = column.toolTip || `Ordenar por ${column.dataField}`;
                    btn.setAttribute('aria-label', btn.title);
                    btn.textContent = column.headerText;
                    btn.addEventListener('click', () => this.sortData(column.dataField));

                    th.appendChild(btn);
                } else {
                    th.textContent = column.headerText;
                    if (column.toolTip) th.title = column.toolTip;
                }

                if (this.options.filter && this.options.filterType === this.eFilterType.Column)
                    th.classList.add('align-top');

                headerRow.appendChild(th);
            });
        }

        // Acciones BTN
        if (this.options.actionsButtons.addEditBtnTbody || this.options.actionsButtons.addDeleteBtnTbody) {
            const th = document.createElement('th');
            if (this.options.filter && this.options.filterType === this.eFilterType.Column)
                th.classList.add('align-top');

            if (this.options.actionsButtons.fixedBtn)
                th.classList.add('fixed-column-header');

            th.innerHTML = 'Acciones';
            headerRow.appendChild(th);
        }

        thead.appendChild(headerRow);
    }

    renderTbody() {
        // Manejo del tbody
        const tbody = this.elements.tbody;
        if (tbody)
            tbody.innerHTML = ''; // Limpiar contenido existente

        if (this.options.selectable && !tbody.dataset.listenerAttached) {
            tbody.addEventListener("click", (event) => {
                if (
                    event.target.type === 'checkbox' ||
                    event.target.type === 'input' ||
                    event.target.type === 'a' ||
                    event.target.type === 'select' ||
                    event.target.type === 'button' ||
                    event.target.hasAttribute('data-disabled-selection') ||
                    event.target.closest('[data-disabled-selection]')
                ) {
                    event.preventDefault();
                    event.stopPropagation();
                    return;
                }

                const clickedRow = event.target.closest("tr");
                if (clickedRow) {
                    const checkbox = clickedRow.querySelector("input[data-row-selectable]");
                    if (checkbox) {
                        // solo invierte el checked cuando esta habilitada la multiple seleccion
                        checkbox.checked = this.options.multipleSelect ? !checkbox.checked : true;
                        this.toggleRowSelection(checkbox);
                    }
                }
            });

            tbody.dataset.listenerAttached = "true";
        }

        // Aplico el paginado,  solo si corresponde
        const paginatedData = this.getPaginatedData();

        if (paginatedData.length > 0) {
            paginatedData.forEach((row) => {
                const tr = document.createElement('tr');

                if (this.options.selectable) {
                    const tdCheckbox = document.createElement('td');
                    const checkbox = document.createElement('input');

                    if (!this.options.multipleSelect) {
                        checkbox.type = 'radio';
                        checkbox.name = `${this.container.id}_table_otp_radio`;
                    } else {
                        checkbox.type = 'checkbox';
                    }

                    checkbox.className = 'form-check-input pe-none';
                    checkbox.dataset.id = row.id;
                    checkbox.dataset.rowSelectable = 'true';
                    checkbox.checked = this.selectedRows.has(row.id);
                    checkbox.title = 'Seleccionar registro';
                    tdCheckbox.appendChild(checkbox);
                    tr.appendChild(tdCheckbox);
                }

                // recorro las columnas
                this.columns.filter(col => col.visible).forEach(column => {
                    const value = row[column.dataField] || ''; // Accedemos al valor en el objeto row
                    const td = document.createElement('td');

                    if (typeof column.template === 'function') {
                        const html = column.template(row, column);
                        if (typeof html === 'string') {
                            td.innerHTML = html;
                        } else {
                            td.appendChild(html);
                        }
                    }
                    else if (column.dataFormatString && column.dataFormatString != '') {
                        td.textContent = this.formatValue(value, column.columnType, column.dataFormatString);
                    } else {
                        td.textContent = value;
                    }

                    tr.appendChild(td);
                });

                // Acciones BTN
                if (this.options.actionsButtons.addEditBtnTbody || this.options.actionsButtons.addDeleteBtnTbody) {
                    const td = document.createElement('td');
                    td.dataset.disabledSelection = "true";

                    const div = document.createElement('div');
                    div.className = 'd-flex gap-2';

                    if (this.options.actionsButtons.addEditBtnTbody) {
                        const btn = document.createElement('button');
                        btn.type = 'button';
                        btn.className = 'btn btn-primary btn-sm bi bi-pencil';
                        btn.title = 'Editar';
                        btn.addEventListener('click', () => {
                            this.createModal(row, true);
                            this.emit('beforeUpdate', { row });
                        });
                        div.appendChild(btn);
                    }

                    if (this.options.actionsButtons.addDeleteBtnTbody) {
                        const btn = document.createElement('button');
                        btn.type = 'button';
                        btn.className = 'btn btn-danger btn-sm bi bi-trash3';
                        btn.title = 'Eliminar';
                        btn.addEventListener('click', () => {
                            this.emit('beforeDelete', { row });
                        });
                        div.appendChild(btn);
                    }

                    td.appendChild(div);
                    tr.appendChild(td);
                }

                tbody.appendChild(tr);
            });
        }
        else {
            const tr = document.createElement('tr');
            const td = document.createElement('td');
            td.textContent = 'Sin registros';
            td.colSpan = this.colSpan;

            tr.appendChild(td);
            tbody.appendChild(tr);
        }


        this.elements.table.appendChild(tbody);
    }

    renderTfoot() {

    }

    renderToobar() {
        const Accitions = Object.entries(this.options.actionsButtons);

        const AnyAccitions = Accitions
            .some(([key, value]) => !key.includes('tbody') && typeof value === 'boolean' && value === true);

        if ((this.options.caption || AnyAccitions || this.options.filter) && !this.container.querySelector('div[data-part="header"]')) {
            const divToolBar = document.createElement('div');
            let countElements = 1;
            divToolBar.className = 'hstack gap-2 align-items-center mb-3';;
            divToolBar.dataset.part = 'header';

            if (this.options.caption) {
                if (this.options.captionAlign === this.eCaptionAlign.Top) {
                    const caption = document.createElement('span');
                    caption.textContent = this.options.caption;
                    divToolBar.appendChild(caption);
                } else if (this.options.captionAlign === this.eCaptionAlign.Bottom) {
                    const caption = document.createElement('caption');
                    caption.textContent = this.options.caption;
                    this.elements.table.insertBefore(caption, this.elements.thead);
                }
            }

            // Filtros
            if (this.options.filter) {
                if (this.options.filterType === this.eFilterType.Single) {
                    const input = document.createElement('input');
                    input.className = 'form-control w-auto';
                    if (this.options.isBoostrapSm) input.classList.add('form-control-sm');
                    if (countElements == 1) input.classList.add('ms-auto');
                    input.placeholder = 'Buscar...';
                    input.autocomplete = 'off';
                    input.type = 'search';
                    input.title = 'Ingrese un valor a buscar';
                    input.setAttribute('aria-label', 'Filtro de busqueda');

                    input.addEventListener('input', (e) => {
                        this.debouncedHandleFilterChange(e.target.value.trim());
                    });

                    divToolBar.appendChild(input);
                    countElements++;
                } else if (this.options.filterType === this.eFilterType.SingleColumn || this.options.filterType === this.eFilterType.SingleColumnMultiple) {

                    const div = document.createElement('div');
                    div.className = 'btn-group';
                    div.dataset.filterType = this.options.filterType;
                    if (countElements == 1) div.classList.add('ms-auto');

                    // Input
                    const input = document.createElement('input');
                    input.className = 'form-control rounded-0 rounded-start z-3 w-auto';
                    if (this.options.isBoostrapSm) input.classList.add('form-control-sm');
                    input.id = `${this.container.id}_inputFiltro`;
                    input.placeholder = 'Buscar...';
                    input.autocomplete = 'off';
                    input.type = 'search';
                    input.title = 'Ingrese un valor a buscar';
                    input.setAttribute('aria-label', 'Filtro de busqueda');

                    input.addEventListener('input', (e) => {
                        this.debouncedHandleFilterChangeMultiple('', e.target.value.trim());
                    });

                    div.appendChild(input);

                    const dropdown = document.createElement('div');
                    dropdown.className = 'btn-group';

                    const btn = document.createElement('button');
                    btn.type = 'button';
                    btn.className = 'btn btn-secondary dropdown-toggle';
                    if (this.options.isBoostrapSm) btn.classList.add('btn-sm');
                    btn.setAttribute('data-bs-toggle', 'dropdown');
                    btn.setAttribute('data-bs-display', 'static');
                    if (this.options.filterType === this.eFilterType.SingleColumnMultiple) btn.setAttribute('data-bs-auto-close', 'outside');
                    btn.setAttribute('aria-expanded', 'false');

                    btn.title = 'Mostrar campos a filtrar';
                    dropdown.appendChild(btn);

                    const ul = document.createElement('ul');
                    ul.className = 'dropdown-menu dropdown-menu-end';
                    ul.addEventListener('click', (event) => {
                        const clicked_li = event.target.closest("li");
                        if (clicked_li) {
                            const checkbox = clicked_li.querySelector("input");
                            if (checkbox) {
                                const isSingleColumn = this.options.filterType === this.eFilterType.SingleColumn;

                                // evita que quite todos los check cuando es multiple
                                if (!isSingleColumn && this.filterDiccionary.size === 1 && checkbox.checked) {
                                    event.preventDefault();
                                    event.stopPropagation();
                                    return;
                                }

                                if (isSingleColumn) this.filterDiccionary.clear();

                                // solo invierte el checked cuando esta habilitada la multiple seleccion
                                checkbox.checked = isSingleColumn ? true : !checkbox.checked;

                                if (checkbox.checked) {
                                    this.filterDiccionary.set(checkbox.value, '');
                                } else {
                                    this.filterDiccionary.delete(checkbox.value);
                                }
                            }
                        }
                    });

                    dropdown.addEventListener('hide.bs.dropdown', () => this.filterData());

                    dropdown.appendChild(ul);

                    // header
                    const liHeader = document.createElement('li');
                    liHeader.className = 'dropdown-header py-0';
                    liHeader.textContent = 'Campos a filtrar';

                    ul.appendChild(liHeader);

                    // Divider
                    const liDivider = document.createElement('li');
                    const hrDivider = document.createElement('hr');
                    hrDivider.className = 'dropdown-divider';

                    liDivider.appendChild(hrDivider);
                    ul.appendChild(liDivider);

                    const isSingleSelect = this.options.filterType === this.eFilterType.SingleColumn;
                    this.columns.filter(col => col.visible && col.filtrable).forEach((col, index) => {

                        // Agrego el primer campo al filtro
                        if (index === 0) this.filterDiccionary.set(col.dataField, '');

                        const li = document.createElement('li');
                        li.className = 'dropdown-item pointer';
                        li.title = `Filtrar por ${(col.headerText || col.dataField).toLowerCase()}`;

                        const name = `${this.container.id}_filter_otp_radio`;
                        const id = `${name}_${index}`;

                        // radio
                        const radio = document.createElement('input');
                        radio.type = isSingleSelect ? 'radio' : 'checkbox';
                        radio.id = id;
                        if (isSingleSelect) radio.name = name;
                        radio.className = 'form-check-input me-1 pe-none';
                        radio.checked = index === 0;
                        radio.value = col.dataField;

                        // label
                        const label = document.createElement('label');
                        label.setAttribute('for', id);
                        label.className = 'form-check-label pe-none';
                        label.textContent = col.headerText || col.dataField;

                        li.appendChild(radio);
                        li.appendChild(label);
                        ul.appendChild(li);
                    });
                    div.appendChild(dropdown);
                    divToolBar.appendChild(div);

                    countElements++;
                }
            }

            // Mostrar ocultar columnas
            if (this.options.actionsButtons.hiddenColumns) {
                const dropdown = document.createElement('div');
                dropdown.className = 'dropdown';
                if (countElements == 1) dropdown.classList.add('ms-auto');
                dropdown.dataset.multipleActions = "hiddenColumns";

                const btn = document.createElement('button');
                btn.type = 'button';
                btn.className = 'btn btn-secondary bi bi-list-ul';
                if (this.options.isBoostrapSm) btn.classList.add('btn-sm');
                btn.setAttribute('data-bs-toggle', 'dropdown');
                btn.setAttribute('data-bs-auto-close', 'outside');
                btn.setAttribute('aria-expanded', 'false');

                btn.title = 'Mostrar / Ocultar campos';
                dropdown.appendChild(btn);

                const ul = document.createElement('ul');
                ul.className = 'dropdown-menu';
                ul.addEventListener('click', (event) => {
                    const clicked_li = event.target.closest("li");
                    if (clicked_li) {
                        const checkbox = clicked_li.querySelector("input");
                        if (checkbox) {
                            const visibleCols = this.columns.filter(col => col.visible).length;

                            // evita que quite todos los check cuando es multiple
                            if (visibleCols === 1 && checkbox.checked) {
                                event.preventDefault();
                                event.stopPropagation();
                                return;
                            }

                            // solo invierte el checked cuando esta habilitada la multiple seleccion
                            checkbox.checked = !checkbox.checked;
                            const col = this.getColumnByName(checkbox.value);
                            col.visible = checkbox.checked;
                        }
                    }
                });

                dropdown.addEventListener('hide.bs.dropdown', () => {
                    this.updateColSpan();
                    this.elements.thead.innerHTML = '';
                    this.renderThead();
                    this.renderTbody();
                });

                dropdown.appendChild(ul);

                // header
                const liHeader = document.createElement('li');
                liHeader.className = 'dropdown-header py-0';
                liHeader.textContent = 'Mostrar / Ocultar campos';

                ul.appendChild(liHeader);

                // Divider
                const liDivider = document.createElement('li');
                const hrDivider = document.createElement('hr');
                hrDivider.className = 'dropdown-divider';

                liDivider.appendChild(hrDivider);
                ul.appendChild(liDivider);

                this.columns.filter(col => col.visible).forEach((col, index) => {
                    const li = document.createElement('li');
                    li.className = 'dropdown-item pointer';
                    li.title = `Mostrar/Ocultar ${(col.headerText || col.dataField).toLowerCase()}`;

                    const id = `${this.container.id}_filter_otp_${index}`;

                    // radio
                    const checkbox = document.createElement('input');
                    checkbox.type = 'checkbox';
                    checkbox.id = id;
                    checkbox.className = 'form-check-input me-1 pe-none';
                    checkbox.checked = col.visible;
                    checkbox.value = col.dataField;

                    // label
                    const label = document.createElement('label');
                    label.setAttribute('for', id);
                    label.className = 'form-check-label pe-none';
                    label.textContent = col.headerText || col.dataField;

                    li.appendChild(checkbox);
                    li.appendChild(label);
                    ul.appendChild(li);
                });

                divToolBar.appendChild(dropdown);

                countElements++;
            }

            if (AnyAccitions) {
                const dropdown = document.createElement('div');
                dropdown.className = 'dropdown';
                if (countElements == 1) dropdown.classList.add('ms-auto');
                dropdown.dataset.multipleActions = "actions";

                const btn = document.createElement('button');
                btn.type = 'button';
                btn.className = 'btn btn-secondary';
                if (this.options.isBoostrapSm) btn.classList.add('btn-sm');
                btn.setAttribute('data-bs-toggle', 'dropdown');
                btn.setAttribute('aria-expanded', 'false');
                btn.innerHTML = 'Acciones <i class="bi bi-three-dots-vertical"></i>';
                btn.title = 'Mostrar Acciones';
                dropdown.appendChild(btn);

                const ul = document.createElement('ul');
                ul.className = 'dropdown-menu';
                dropdown.appendChild(ul);

                if (this.options.actionsButtons.addNewBtn) {

                    const li = document.createElement('li');

                    // Btn
                    const btn = document.createElement('button');
                    btn.type = 'button';
                    btn.className = 'dropdown-item bi bi-plus-lg i-m';
                    btn.title = 'Agregar nuevo elemento';
                    btn.setAttribute('aria-label', btn.title);
                    btn.textContent = 'Agregar';
                    btn.addEventListener('click', () => this.createModal({}, false));
                    li.appendChild(btn);
                    ul.appendChild(li);
                    countElements++;
                }

                // Btn descarga
                if (this.options.actionsButtons?.autoGenerateBtnDowload) {
                    const li = document.createElement('li');

                    // Btn
                    const btn = document.createElement('button');
                    btn.type = 'button';
                    btn.className = 'dropdown-item bi bi-download i-m';
                    btn.title = 'Descargar registros en formato CSV';
                    btn.setAttribute('aria-label', btn.title);
                    btn.textContent = 'Descargar CSV';
                    btn.addEventListener('click', (e) => {
                        if (typeof showWorking === 'function')
                            showWorking(true, 'Descargando espere...', e.target);

                        this.exportarCSV(e.target);
                    });
                    li.appendChild(btn);
                    ul.appendChild(li);
                    countElements++;
                }

                if (this.options.actionsButtons.addDeleteSelect) {
                    const li = document.createElement('li');

                    // Btn
                    const btn = document.createElement('button');
                    btn.type = 'button';
                    btn.className = 'dropdown-item bi bi-trash i-m';
                    btn.title = 'Eliminar elementos seleccionados';
                    btn.setAttribute('aria-label', btn.title);
                    btn.textContent = 'Eliminar multiples';
                    //btn.addEventListener('click', () => this.createModal({}, false));
                    li.appendChild(btn);
                    ul.appendChild(li);
                    countElements++;
                }

                if (countElements > 0) divToolBar.appendChild(dropdown);
            }


            if (countElements > 0) this.container.insertBefore(divToolBar, this.container.firstChild);
        }
    }

    renderLoader() {
        const table = this.elements.table;
        if (!table.classList.contains('pe-none'))
            table.classList.add('pe-none')

        // Manejo del tbody
        const tbody = this.elements.tbody;

        this.updateColSpan();

        // Fila superior con barra de carga (opcional)
        const tr = document.createElement('tr');
        tr.dataset.progressBar = 'true';
        const td = document.createElement('td');
        td.className = 'py-3';
        td.colSpan = this.colSpan;

        td.innerHTML = `
            <span class='d-flex flex-column text-center col-12'>
                <span>Cargando espere...</span>
                <div class='progress-bar'>
                    <div class='progress-bar-value'></div>
                </div>
            </span>`;
        tr.appendChild(td);
        tbody.insertBefore(tr, tbody.firstChild);
    }

    hiddenLoader() {
        const table = this.elements.table;
        table.classList.remove('pe-none');
        const tbody = this.elements.tbody;

        // Buscar y eliminar la fila con el loader
        const loaderRow = tbody.querySelector('tr[data-progress-bar]');
        if (loaderRow) {
            tbody.removeChild(loaderRow);
        }
    }

    updateColSpan() {
        const currenColSpan = this.data && this.data.length > 0
            ? this.columns.filter(col => col.visible).length + (this.options.selectable ? 1 : 0) + (this.options.actionsButtons.addEditBtnTbody || this.options.actionsButtons.addDeleteBtnTbody ? 1 : 0)
            : 1

        if (this.options.colSpan) {
            this.colSpan = this.options.colSpan;
        }
        else if (this.colSpan !== currenColSpan) {
            this.colSpan = currenColSpan;
        }
    }

    /** Renderiza la paginación */
    renderPagination() {
        this.needReRenderPagination = false;
        let footer = this.container.querySelector('footer');

        // Controles de paginación
        if (!footer) {
            footer = document.createElement('footer');
        } else {
            footer.innerHTML = '';
        }
        footer.className = 'd-flex flex-wrap justify-content-sm-between justify-content-center align-items-center gap-2';
        footer.dataset.part = 'footer';

        const spanSelect = document.createElement('span');
        spanSelect.className = 'd-flex align-items-center gap-2';

        const selectId = `${this.container.id}_pageSizeSelect`;
        const lbMostrar = document.createElement('label');
        lbMostrar.innerText = 'Mostrar';
        lbMostrar.className = 'text-muted small';
        lbMostrar.setAttribute('for', selectId);

        // Selector de tamaño de página
        const pageSizeSelect = document.createElement('select');
        pageSizeSelect.className = 'form-select w-auto';
        if (this.options.isBoostrapSm) pageSizeSelect.classList.add('form-select-sm');
        pageSizeSelect.title = 'Cantidad de registros por pagina';
        pageSizeSelect.id = selectId;
        this.options.pageList.forEach(size => {
            const option = document.createElement('option');
            option.value = size;
            option.textContent = size === 'All' ? 'Todos' : size;
            option.selected = size === this.options.pageSize || this.lastPageSize === 'All';
            if (option.selected) option.setAttribute('selected', '');
            pageSizeSelect.appendChild(option);
        });

        pageSizeSelect.addEventListener('change', (e) => {
            if (this.options.sideActions === this.eSideAction.Server) {
                this.options.pageSize = e.target.value === 'All' ? this.serverTotalRows : parseInt(e.target.value);
            } else {
                this.options.pageSize = e.target.value === 'All' ? this.data.length : parseInt(e.target.value);
            }

            this.lastPageSize = e.target.value;
            this.currentPage = 1;
            this.needReRenderPagination = true;
            this.handleDataChange();
            this.emit('PageSizeChange', { pageSize: this.lastPageSize });
        });

        if (this.filteredData.length <= 0) {
            pageSizeSelect.disabled = true;
            pageSizeSelect.setAttribute('disabled', 'disabled');
        }

        const lbRegistros = document.createElement('label');
        lbRegistros.innerText = 'Registros';
        lbRegistros.className = 'text-muted small';
        lbRegistros.setAttribute('for', selectId);

        spanSelect.appendChild(lbMostrar);
        spanSelect.appendChild(pageSizeSelect);
        spanSelect.appendChild(lbRegistros);

        // Botones de navegación
        const nav = document.createElement('nav');
        nav.setAttribute('aria-label', 'Page navigation');

        const ul = document.createElement('ul');
        ul.className = 'pagination mb-0';
        if (this.options.isBoostrapSm) ul.classList.add('pagination-sm');

        // primero
        const firstLi = document.createElement('li');
        const isfirstDisabled = this.currentPage === 1;
        firstLi.classList.add('page-item');
        if (isfirstDisabled) firstLi.classList.add('disabled');

        const firstButton = document.createElement('button');
        firstButton.type = 'button';
        firstButton.className = 'page-link bi bi-chevron-double-left';
        firstButton.title = 'Ir a la primera pagina';
        firstButton.setAttribute('aria-label', firstButton.title);
        firstButton.disabled = isfirstDisabled;
        firstButton.addEventListener('click', () => {
            this.currentPage = 1;
            this.needReRenderPagination = true;
            this.handleDataChange();
            this.emit('PageChange', { page: this.currentPage });
        });

        firstLi.appendChild(firstButton);
        ul.appendChild(firstLi);

        // Anteriror
        const prevLi = document.createElement('li');
        prevLi.classList.add('page-item');
        if (isfirstDisabled) prevLi.classList.add('disabled');

        const prevButton = document.createElement('button');
        prevButton.type = 'button';
        prevButton.className = 'page-link bi bi-chevron-left';
        prevButton.title = 'Ir a la pagina anterior';
        prevButton.setAttribute('aria-label', prevButton.title);
        prevButton.disabled = isfirstDisabled;
        prevButton.addEventListener('click', () => {
            this.currentPage--;
            this.needReRenderPagination = true;
            this.handleDataChange();
            this.emit('PageChange', { page: this.currentPage });
        });

        prevLi.appendChild(prevButton);
        ul.appendChild(prevLi);

        // Dentro de tu método renderPagination (o donde generes los números de página):
        const totalPages = this.getLastPage();
        const maxVisiblePages = 5; // Máximo 5 números visibles
        let startPage, endPage;

        // Calcula el rango de páginas a mostrar
        if (totalPages <= maxVisiblePages) {
            // Si hay menos de 5 páginas, muestra todas
            startPage = 1;
            endPage = totalPages;
        } else {
            // Si hay más de 5 páginas, centra la página actual
            const half = Math.floor(maxVisiblePages / 2);
            if (this.currentPage <= half + 1) {
                startPage = 1;
                endPage = maxVisiblePages;
            } else if (this.currentPage >= totalPages - half) {
                startPage = totalPages - maxVisiblePages + 1;
                endPage = totalPages;
            } else {
                startPage = this.currentPage - half;
                endPage = this.currentPage + half;
            }
        }

        // Genera los botones de página
        for (let index = startPage; index <= endPage; index++) {
            const li = document.createElement('li');
            const isActive = this.currentPage === index;
            li.classList.add('page-item');
            if (isActive) li.classList.add('active');

            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'page-link';
            btn.innerText = index;

            if (isActive) {
                btn.title = `Estás en la página número ${index}`;
                btn.setAttribute('aria-current', 'page');
                btn.setAttribute('aria-label', btn.title);
                btn.disabled = true;
            } else {
                btn.title = `Ir a la página número ${index}`;
                btn.setAttribute('aria-label', btn.title);
                btn.addEventListener('click', () => {
                    this.currentPage = index;
                    this.needReRenderPagination = true;
                    this.handleDataChange();
                    this.emit('PageChange', { page: this.currentPage });
                });
            }

            li.appendChild(btn);
            ul.appendChild(li);
        }

        // next
        const nextLi = document.createElement('li');
        const isLastDisabled = this.currentPage >= this.getLastPage();
        nextLi.classList.add('page-item');
        if (isLastDisabled) nextLi.classList.add('disabled');

        const nextButton = document.createElement('button');
        nextButton.type = 'button';
        nextButton.className = 'page-link bi bi-chevron-right';
        nextButton.title = 'Ir a la pagina siguiente';
        nextButton.setAttribute('aria-label', nextButton.title);
        nextButton.disabled = isLastDisabled;
        nextButton.addEventListener('click', () => {
            this.currentPage++;
            this.needReRenderPagination = true;
            this.handleDataChange();
            this.emit('PageChange', { page: this.currentPage });
        });

        nextLi.appendChild(nextButton);
        ul.appendChild(nextLi);

        // Last
        const LastLi = document.createElement('li');
        LastLi.classList.add('page-item');
        if (isLastDisabled) LastLi.classList.add('disabled');

        const LastButton = document.createElement('button');
        LastButton.type = 'button';
        LastButton.className = 'page-link bi bi-chevron-double-right';
        LastButton.title = 'Ir a la ultima pagina';
        LastButton.setAttribute('aria-label', LastButton.title);
        LastButton.disabled = isLastDisabled;
        LastButton.addEventListener('click', () => {
            this.currentPage = this.getLastPage();
            this.needReRenderPagination = true;
            this.handleDataChange();
            this.emit('PageChange', { page: this.currentPage });
        });

        LastLi.appendChild(LastButton);
        ul.appendChild(LastLi);

        nav.appendChild(ul);

        footer.appendChild(nav);
        footer.appendChild(spanSelect);

        this.container.appendChild(footer);
    }

    normalize = (str) =>
        String(str)
            .normalize("NFD")               // descompone acentos
            .replace(/[\u0300-\u036f]/g, "") // elimina caracteres diacríticos
            .toLowerCase();

    /** Filtra los datos */
    // filterData(column, value) {
    //     const filterValue = this.normalize(value);
    //     if (this.options.sideActions === this.eSideAction.Client) {
    //         this.filteredData = this.data.filter(row => {
    //             const dataValue = this.normalize(String(row[column.dataField]));
    //             return dataValue.includes(filterValue);
    //         });
    //     } else {
    //         this.filterDiccionary.set(column, filterValue);
    //     }

    //     this.currentPage = 1;
    //     this.emit('FilrerChange', { column, value });
    //     this.handleDataChange();
    // }

    ChangeFilterMultiple(campo, valor) {

        if (this.options.filterType !== this.eFilterType.SingleColumn && this.options.filterType !== this.eFilterType.SingleColumnMultiple) {
            if (valor === '') {
                this.filterDiccionary.delete(campo);
            } else {
                this.filterDiccionary.set(campo, valor);
            }
        } else {
            this.filterValue = valor;
        }

        this.filterData();
    }

    filterData() {
        if (this.options.sideActions === this.eSideAction.Client) {

            const isSingleField = this.options.filterType === this.eFilterType.SingleColumn || this.options.filterType === this.eFilterType.SingleColumnMultiple
            const filtros = isSingleField
                ? this.filterDiccionary
                : Array.from(this.filterDiccionary.entries())
                    .filter(([key, value]) => value !== '')
                    .reduce((acc, [key, value]) => {
                        acc.set(key, value);
                        return acc;
                    }, new Map());

            const fvalue = this.normalize(this.filterValue);

            if (isSingleField && fvalue === '') {
                this.filteredData = this.data;
            } else {
                // aplica todos los filtros acumulados
                this.filteredData = this.data.filter(row => {
                    // Verifica todos los filtros en el diccionario
                    let include = filtros.size === 0;
                    for (const [col, val] of filtros) {
                        const dataValue = this.normalize(String(row[col]));
                        include = dataValue.includes(isSingleField ? fvalue : val);

                        if (include)
                            return include;
                    }

                    return include;
                });
            }
        }

        this.currentPage = 1;
        this.needReRenderPagination = true;
        console.log(this.filterDiccionary);
        this.emit('FilterChange', { Filters: Object.fromEntries(this.filterDiccionary) });
        this.handleDataChange();
    }

    filterAllData(value) {
        const filterValue = this.normalize(value);
        if (this.options.sideActions === this.eSideAction.Client) {
            this.filteredData = this.data.filter(row => {
                // Combina todos los valores de las propiedades del objeto en un solo string
                const rowValues = this.normalize(Object.values(row).join(' '));
                return rowValues.includes(filterValue);
            });
        } else {
            this.filterDiccionary.set('All', filterValue);
        }

        this.currentPage = 1;
        this.needReRenderPagination = true;
        this.emit('FilrerChange', { column: 'All', value });
        this.handleDataChange();
    }

    /** Ordena los datos */
    sortData(column) {
        if (this.sortColumn === column) {
            this.sortDirection = this.sortDirection === this.eSortDirection.Asc ? this.eSortDirection.Desc : this.eSortDirection.Asc;
        } else {
            this.sortColumn = column;
            this.sortDirection = this.eSortDirection.Asc;
        }

        if (this.options.sideActions === this.eSideAction.Client) {
            const columnDef = this.getColumnByName(column);

            this.filteredData.sort((a, b) => {
                const rawA = a[column];
                const rawB = b[column];
                let compare = 0;

                switch (columnDef.columnType) {
                    case this.eColumnType.Number:
                        compare = (Number(rawA) || -Infinity) - (Number(rawB) || -Infinity);
                        break;

                    case this.eColumnType.Decimal:
                        compare = (parseFloat(rawA) || -Infinity) - (parseFloat(rawB) || -Infinity);
                        break;

                    case this.eColumnType.Date:
                    case this.eColumnType.DateTime:
                        // DateTime también cae aquí; Date.parse acepta ambos formatos ISO
                        compare = new Date(rawA) - new Date(rawB);
                        break;

                    case this.eColumnType.Select:
                    case this.eColumnType.Text:
                        // Si es un select, probablemente rawA/rawB sean strings/tags:
                        compare = String(rawA).localeCompare(String(rawB));
                        break;

                    default:
                        // Texto por defecto o valores desconocidos
                        compare = String(rawA).localeCompare(String(rawB));
                        break;
                }

                // Invertir si la dirección es Desc
                return this.sortDirection === this.eSortDirection.Asc
                    ? compare
                    : -compare;
            });
        }

        this.emit('SortChange', { sortColumn: this.sortColumn, sortDirection: this.sortDirection });
        this.handleDataChange();
    }

    /** Obtiene los datos paginados */
    getPaginatedData() {
        if (!this.options.pagination || this.options.sideActions === this.eSideAction.Server) return this.filteredData;

        const start = (this.currentPage - 1) * this.options.pageSize;
        const end = start + this.options.pageSize;
        return this.filteredData.slice(start, end);
    }

    /** Selecciona/Deselecciona una fila */
    toggleRowSelection(checkbox) {
        if (!this.options.multipleSelect)
            this.selectedRows.clear();

        const rowId = parseInt(checkbox.dataset.id);
        if (checkbox.checked) {
            this.selectedRows.add(rowId);
        } else {
            this.selectedRows.delete(rowId);
        }

        if (this.options.multipleSelect)
            this.updateIntermediate();

        this.emit('selectedChange', { rows: this.getSelectedRows() });
    }

    /** Selecciona/Deselecciona todas las filas */
    toggleSelectAll(e) {
        this.selectedRows.clear();

        if (e.target.checked) {
            this.data.forEach(cb => {
                this.selectedRows.add(cb.id);
            });
        }

        const checkboxes = this.elements.tbody.querySelectorAll('input[type="checkbox"][data-row-selectable]');
        checkboxes.forEach(checkbox => {
            checkbox.checked = e.target.checked;
        });

        this.emit('selectedChange', { rows: this.getSelectedRows() });
        this.emit('selectedAllChange', { checked: e.target.checked, rows: this.getSelectedRows() });
    }

    getLastPage() {
        if (this.options.sideActions == this.eSideAction.Server) {
            return Math.ceil(this.serverTotalRows / this.options.pageSize);
        } else {
            return Math.ceil(this.filteredData.length / this.options.pageSize);
        }
    }

    textFormat(texto) {
        if (!texto) return '';
        return texto.charAt(0).toUpperCase() + texto.slice(1).toLowerCase();
    }

    updateIntermediate() {
        const cb = this.elements.thead.querySelector('input[type="checkbox"][data-select-all]');
        if (!cb) return;

        const hasSelectedRows = this.selectedRows.size > 0;
        const allSelected = this.selectedRows.size === this.data.length && this.data.length > 0;

        cb.indeterminate = hasSelectedRows && !allSelected;
        cb.checked = allSelected;
    }

    validateEnum(paramName, value, enumObj, defaultValue) {
        if (value === undefined || value === null) {
            return defaultValue;
        }

        // Verifica si el valor está en los valores del enum
        const validValues = Object.values(enumObj);
        if (validValues.includes(value)) {
            return value;
        }

        console.error(`el parametro: ${paramName} tiene un valor inválido: "${value}". Opciones válidas: [${validValues.join(', ')}]`);
        return defaultValue;
    }

    async loadDataFromUrl() {
        try {
            this.data = await this.getDataFromUrl();
            this.filteredData = [...this.data];
        } catch (error) {
            console.error('Error al cargar:', error);
        }
    }

    async getDataFromUrl() {
        try {
            // Validación básica de URL
            if (!this.options.fechUrl.url || typeof this.options.fechUrl.url !== 'string') {
                throw new Error('URL no válida');
            }

            // Construcción de la URL con parámetros
            const urlWithParams = new URL(this.options.fechUrl.url);

            if (this.options.sideActions === this.eSideAction.Server) {
                const filterKeys = [];
                const filterValues = [];

                this.filterDiccionary.forEach((value, key) => {
                    filterKeys.push(key.dataField);
                    filterValues.push(value.replace(';', ''));
                });

                const baseParams = {
                    currentPage: this.currentPage,
                    pageSize: this.lastPageSize || this.options.pageList[0],
                    filterColumn: filterKeys.join(';'),
                    filterValue: filterValues.join(';'),
                    sortColumn: this.sortColumn ?? '',
                    sortDirection: this.sortDirection,
                    ...this.options.queryParams
                };

                Object.entries(baseParams).forEach(([key, value]) => {
                    urlWithParams.searchParams.append(key, value);
                });
            }

            const response = await fetch(urlWithParams.toString(), {
                headers: {
                    'Content-Type': 'application/json',
                },
            });

            if (!response.ok) {
                throw new Error(`Error HTTP: ${response.status} ${response.statusText}`);
            }

            const res = await response.json();
            this.serverTotalRows = res.totalRows;

            return res.rows;
        } catch (error) {
            console.error('Error en getDataFromUrl:', {
                url,
                error: error.message,
                params: { currentPage, pageSize, searchField, searchValue, queryParams }
            });
            throw error;
        }
    }

    async ActionsPost(url, data) {
        try {
            const response = await fetch(url, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify(data)
            });

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`Error ${response.status}: ${errorText}`);
            }

            return await response.json();
        } catch (error) {
            console.error("Error en postJson:", error);
            throw error;
        }
    }

    // Metodos publics

    getSelectedRows() {
        return this.data.filter(row =>
            this.selectedRows.has(row.id)
        );
    }

    createModal(row, isEdit = false) {
        // Crear elementos
        const modal = document.createElement('div');
        modal.className = 'modal fade';
        modal.id = `${this.container.id}_modal`;
        modal.tabIndex = -1;
        modal.dataset.bsBackdrop = 'static';
        modal.dataset.bsKeyboard = 'false';
        modal.setAttribute('aria-labelledby', 'staticBackdropLabel');
        modal.setAttribute('aria-hidden', 'true');

        const modalDialog = document.createElement('div');
        modalDialog.className = 'modal-dialog modal-dialog-centered modal-dialog-scrollable modal-xl';

        // From
        const formContent = document.createElement('form');
        formContent.className = 'modal-content';
        formContent.autocomplete = 'off';
        formContent.method = 'post';
        formContent.name = `form_${this.container.id}`;
        formContent.action = isEdit ? (this.options.fechUrl.urlUpdate || '#') : (this.options.fechUrl.urlInsert || '#');
        formContent.setAttribute('novalidate', '');

        // Header
        const modalHeader = document.createElement('div');
        modalHeader.className = 'modal-header';

        const modalTitle = document.createElement('h1');
        modalTitle.className = 'modal-title fs-5';
        modalTitle.id = 'staticBackdropLabel';
        modalTitle.textContent = isEdit ? 'Editar' : 'Crear';

        const btnClose = document.createElement('button');
        btnClose.type = 'button';
        btnClose.className = 'btn-close';
        btnClose.dataset.bsDismiss = 'modal';
        btnClose.setAttribute('aria-label', 'Cerrar modal');
        btnClose.title = 'Cerrar modal';

        // body
        const modalBody = document.createElement('div');
        modalBody.className = 'modal-body';

        const rowDiv = document.createElement('div');
        rowDiv.className = 'row g-3';

        let firsFocus;
        this.columns.filter(c => c.visible).forEach((col, id) => {
            const colDiv = document.createElement('div');
            colDiv.className = col.modalBoostrapCol || this.options.actionsButtons.modalBoostrapCol;

            const idRow = `${this.container.id}_input_${col.dataField}_${id}`;

            const label = document.createElement('label');
            label.className = 'form-label';
            label.setAttribute('for', idRow);
            label.textContent = col.headerText;

            const input = document.createElement('input');
            input.id = idRow;
            input.name = `${this.container.id.toLowerCase()}_input$${col.dataField}`;
            input.dataset.field = col.dataField;
            input.type = this.getInputType(col.columnType);
            input.className = 'form-control';
            input.placeholder = col.headerText;
            input.title = col.title || `Ingrese ${col.headerText}`;

            let inputValue = row[col.dataField] ?? '';

            if (col.dataFormatString) {
                const isDateField = col.columnType === this.eColumnType.Date || col.columnType === this.eColumnType.DateTime;
                const formatString = isDateField
                    ? (col.columnType === this.eColumnType.DateTime ? 'yyyy-MM-ddTHH:mm' : 'yyyy-MM-dd') // si es date cambio el fomrato, para que se vea en el input type date
                    : col.dataFormatString;

                inputValue = this.formatValue(inputValue, col.columnType, formatString);
            }

            input.value = inputValue;
            input.dataset.value = inputValue;
            if (id === 0) firsFocus = input;

            colDiv.appendChild(label);
            colDiv.appendChild(input);
            rowDiv.appendChild(colDiv);
        });

        modalBody.appendChild(rowDiv);

        // footer
        const modalFooter = document.createElement('div');
        modalFooter.className = 'modal-footer';

        const btnSave = document.createElement('button');
        btnSave.type = 'submit';
        btnSave.className = 'btn btn-primary bi bi-check2 m-icon';
        btnSave.textContent = 'Guardar';
        btnSave.title = 'Guardar informacion';
        btnSave.setAttribute('aria-label', btnSave.title);

        const btnClose2 = document.createElement('button');
        btnClose2.type = 'button';
        btnClose2.className = 'btn btn-secondary bi bi-x-lg m-icon';
        btnClose2.dataset.bsDismiss = 'modal';
        btnClose2.textContent = 'Cerrar';
        btnClose2.title = 'Cerrar modal';
        btnClose2.setAttribute('aria-label', btnClose2.title);

        // Armar jerarquía
        modalHeader.appendChild(modalTitle);
        modalHeader.appendChild(btnClose);

        modalFooter.appendChild(btnSave);
        modalFooter.appendChild(btnClose2);

        formContent.appendChild(modalHeader);
        formContent.appendChild(modalBody);
        formContent.appendChild(modalFooter);

        modalDialog.appendChild(formContent);
        modal.appendChild(modalDialog);

        // Agregar al DOM
        document.body.appendChild(modal);

        // Mostrar el modal usando Bootstrap 5
        const bootstrapModal = new bootstrap.Modal(modal);
        bootstrapModal.show();

        // Escuchar cuando el modal se oculta completamente
        modal.addEventListener('hidden.bs.modal', () => {
            modal.remove(); // Eliminar del DOM
        });

        modal.addEventListener('shown.bs.modal', () => {
            if (firsFocus) firsFocus.focus();
        });

        // Suscribirse al evento submit
        formContent.addEventListener('submit', (event) => {
            event.preventDefault(); // Evita el envío del formulario

            const formData = new FormData(formContent);
            const data = {};

            formData.forEach((value, key) => {
                // Tomamos solo la última parte después del $
                const keyParts = key.split('$');
                const newKey = keyParts[keyParts.length - 1];

                data[newKey] = value;
            });

            this.emit('afterUpdate', { beforeData: data, afterData: row });

            bootstrapModal.hide();

            this.ActionsPost(isEdit ? this.options.urlUpdate : this.options.urlInsert, { beforeData: data, afterData: row });
        });

        $(`#${this.container.id}_modal`).draggable();// Agrego para que se pueda arrastrar el modal
    }

    /**
     * Inicializa this.columns usando las propiedades encontradas en this.data.
     * Recoge todas las claves de cada objeto en this.data (uniéndolas en un Set
     * para eliminar duplicados) y crea una columna por cada una.
     */
    initializeColumnsFromData() {
        if (this.options.autoGenerateColums) {
            // Asegurarnos de que this.data sea un array y tenga al menos un elemento
            if (!Array.isArray(this.data) || this.data.length === 0 || typeof this.data[0] !== 'object') {
                return;
            }

            // Conjunto de dataField ya existentes
            const existingFields = new Set(
                this.columns.map(col => col.dataField)
            );

            const _columns = [...this.columns];
            const keys = Object.keys(this.data[0]);

            // Recorremos solo las keys del primer objeto
            keys.filter(col => !existingFields.has(col)).forEach((fieldName) => {
                _columns.push({
                    dataField: fieldName,
                    headerText: this.textFormat(fieldName),
                    columnType: this.eColumnType.Text,
                    dataFormatString: undefined,
                    toolTip: undefined,
                    columnOrder: keys.indexOf(fieldName),
                    enableUpdate: true,
                    visible: true,
                    sorteable: true,
                    filtrable: true,
                    modalBoostrapCol: this.options.actionsButtons.modalBoostrapCol || 'auto',
                });
            });

            this.columns = _columns;
        }

        // Ahora ordenamos this.columns por columnOrder ascendente
        this.columns.sort((a, b) => {
            const oa = typeof a.columnOrder === 'number' ? a.columnOrder : 0;
            const ob = typeof b.columnOrder === 'number' ? b.columnOrder : 0;
            return oa - ob;
        });

        this.container.dataset.initializeColumns = 'True';
    }


    getColumnByName(dataField) {
        if (typeof dataField !== 'string' || !dataField) {
            console.error('getColumnByName: debes pasar un dataField válido (string).');
            return null;
        }

        // Buscamos
        const col = this.columns.find(c => c.dataField === dataField);
        return col || null;
    }

    /**
     * Formatea un valor según su tipo y un string de formato opcional.
     * @param {*} value              – El valor a formatear (number | Date | string | null | undefined).
     * @param {string|object} [fmt]  – Especificación de formato:
     *    • Para números: 'currency:USD', 'percent', 'decimal:2' (decimales)
     *    • Para fechas: un objeto de opciones Intl.DateTimeFormat, p.ej. { year:'numeric', month:'2-digit', day:'2-digit' }
     *    • Para strings: 'upper', 'lower', 'capitalize'
     * @param {string} [locale='en-US']
     * @returns {string}
     */
    formatValue(value, valueType, fmt, locale = 'es-AR') {
        if (value == null) return '';
        // Números
        if (valueType === this.eColumnType.Number || valueType === this.eColumnType.Decimal) {
            if (typeof fmt === 'string') {
                const [type, arg] = fmt.split(':');
                const options = {};
                switch (type) {
                    case 'currency':
                        options.style = 'currency';
                        options.currency = arg || 'arg';
                        break;
                    case 'percent':
                        options.style = 'percent';
                        break;
                    case 'decimal':
                        const decimals = parseInt(arg, 10);
                        if (!isNaN(decimals)) {
                            options.minimumFractionDigits = decimals;
                            options.maximumFractionDigits = decimals;
                        } else {
                            options.minimumFractionDigits = 2;
                            options.maximumFractionDigits = 2;
                        }
                        break;

                }
                return (new Intl.NumberFormat(locale, options).format(value)).replace('ARG', '$');
            }
            // sin fmt → formato local por defecto
            return new Intl.NumberFormat(locale).format(value);
        }

        // Fechas
        if (valueType === this.eColumnType.Date || valueType === this.eColumnType.DateTime) {
            const dateValue = typeof value === 'string' ? new Date(value) : value;
            if (!(dateValue instanceof Date) || isNaN(dateValue)) {
                return '';
            }

            // Si nos pasan un string de formato tipo 'yyyy-MM-dd HH:mm:ss'
            if (typeof fmt === 'string') {
                // extraemos partes
                const yyyy = dateValue.getFullYear();
                const MM = String(dateValue.getMonth() + 1).padStart(2, '0');
                const dd = String(dateValue.getDate()).padStart(2, '0');
                const HH = String(dateValue.getHours()).padStart(2, '0');
                const mm = String(dateValue.getMinutes()).padStart(2, '0');
                const ss = String(dateValue.getSeconds()).padStart(2, '0');

                // reemplazamos tokens en el fmt
                return fmt
                    .replace(/yyyy/g, yyyy)
                    .replace(/MM/g, MM)
                    .replace(/dd/g, dd)
                    .replace(/HH/g, HH)
                    .replace(/mm/g, mm)
                    .replace(/ss/g, ss);
            }

            // Si fmt es un objeto de opciones Intl.DateTimeFormat
            if (fmt && typeof fmt === 'object') {
                return new Intl.DateTimeFormat(locale, fmt).format(dateValue);
            }

            // Default fallback con Intl y formato completo
            const options = {
                year: 'numeric',
                month: '2-digit',
                day: '2-digit',
                hour: '2-digit',
                minute: '2-digit'
            };
            return new Intl.DateTimeFormat(locale, options).format(dateValue);
        }


        // Strings
        if (valueType === this.eColumnType.text) {
            switch (fmt) {
                case 'upper':
                    return value.toUpperCase();
                case 'lower':
                    return value.toLowerCase();
                case 'capitalize':
                    return value.charAt(0).toUpperCase() + value.slice(1).toLowerCase();
                default:
                    return value;
            }
        }

        return String(value);
    }

    getInputType(columnType) {
        let inputType;
        switch (columnType) {
            case this.eColumnType.text:
                inputType = 'search'
                break;
            case this.eColumnType.Number:
            case this.eColumnType.Decimal:
                inputType = 'number'
                break;
            case this.eColumnType.Date:
                inputType = 'date'
                break;
            case this.eColumnType.DateTime:
                inputType = 'datetime-local'
                break;

            default:
                inputType = 'search'
                break;
        }

        return inputType;
    }

    exportarCSV(btn) {
        if (!Array.isArray(this.data) || this.data.length === 0) {
            console.log("Download File ... FAIL !");
            if (typeof createSimpleToast === 'function')
                createSimpleToast('ERROR: Fallo al descargar el archivo', 'bg-danger', 'bi bi-exclamation-triangle-fill');

            if (typeof showWorking === 'function')
                showWorking(false, '', btn);
            return;
        }

        const colums = this.columns.filter(col => col.visible);
        const _data = this.options.exportData.dowloadFilterData ? this.filteredData : this.data;
        const delimiterCaracter = this.options.exportData?.delimiterCaracter;

        const filas = _data.map(row =>
            colums.map(field => {
                let valor = row[field.dataField] != null ? row[field.dataField].toString() : '';
                if (valor !== '' && field.dataFormatString)
                    valor = this.formatValue(valor, field.columnType, field.dataFormatString);

                return `"${valor.replace(/"/g, '""')}"`; // escapamos comillas
            }).join(delimiterCaracter)
        );

        // Conbino la cabecera con los datos
        const contenidoCSV = [colums.map(col => col.headerText || col.dataField).join(delimiterCaracter), ...filas].join('\r\n');
        const blob = new Blob([contenidoCSV], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);

        const enlace = document.createElement('a');
        enlace.href = url;
        enlace.download = `${this.options.exportData?.fileName}.csv`;
        document.body.appendChild(enlace);
        enlace.click();
        document.body.removeChild(enlace);
        URL.revokeObjectURL(url);

        console.log("Download File ... OK !");
        if (typeof createSimpleToast === 'function')
            createSimpleToast('Descarga finalizada', 'bg-success', 'bi bi-check2-circle');
        //Ocultar la mascara
        if (typeof showWorking === 'function')
            showWorking(false, '', btn);
    }

}