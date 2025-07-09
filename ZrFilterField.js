class ZrFilterField {
    constructor(containerId, data, options = {}) {
        this.container = document.getElementById(containerId);
        this.data = data;
        this.eFilterType = {
            Multiple: 'multiple',
            Single: 'single',
        };

        this.eFieldType = {
            Text: 'text',
            Number: 'number',
            Decimal: 'decimal',
            Date: 'date',
            DateTime: 'dateTime',
        };

        this.defaultFieldTemplate = {
            name: undefined,
            text: '',
            title: '',
            type: this.eFieldType.Text,
            visible: true,
            checked: false,
            order: 0,
        };

        this.options = {
            filterType: this.validateEnum('filterType', options.filterType, this.eFilterType, this.eFilterType.Multiple),
            autoGenerateField: options.autoGenerateField || true,
            minSelected: options.minSelected || 1,
            size: options.size,
            autoPostBack: options.autoPostBack || false,
            createLabel: options.createLabel || false,
            isOpen: options.isOpen || false,
            inputValue: options.inputValue,
            texts: {
                placeholder: options.texts?.placeholder || 'Buscar...',
                title: options.texts?.title || 'Ingrese un valor a buscar',
                placeholderDropdown: options.texts?.placeholderDropdown || `Campo${(options.filterType === this.eFilterType.Multiple ? "s" : "")} a filtrar`,
                titleDropdown: options.texts?.titleDropdown || `Seleccione ${(options.filterType === this.eFilterType.Multiple ? "los campos" : "un campo")} a filtrar`,
                titleOption: options.texts?.titleOption || 'Seleccionar campo',
            },

            ...options
        };


        this.fields = Array.isArray(options.fields)
            ? options.fields
                .filter(col => col && typeof col.name === 'string')
                .map(col => {
                    const mergedField = { ...this.defaultFieldTemplate };

                    Object.keys(mergedField).forEach(key => {
                        if (col[key] !== undefined) { // Solo asigna las propiedades que existen
                            mergedField[key] = key === 'type'
                                ? this.validateEnum('fieldType', col.type, this.eFieldType, this.eFieldType.Text)
                                : col[key];
                        }
                    });

                    return mergedField;
                })
            : [];

        this.elements = {
            input: this.container.querySelector('input[data-input-filter="True"]') || document.createElement('input'),
            ul: this.container.querySelector('ul') || document.createElement('ul'),
            tigger: this.container.querySelector('button') || document.createElement('button'),
            label: this.container.querySelector('label[data-label-filter="True"]') || document.createElement('label'),
        };

        this.filterValue = options.filterValue || '';
        this.filteredFields = options.filteredFields || [];
        this.isInit = false;
        this._eventTarget = new EventTarget();

        // Método debounce
        this.debouncedHandleFilterChange = this.debounce(this.filterChangeValue.bind(this), 800);

        if ((this.data || this.options.fields) && !this.isInit) {
            this.init();
        }
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

    emit(eventName, detail = {}) {
        const event = new CustomEvent(eventName, { detail });
        this._eventTarget.dispatchEvent(event);
    }

    on(eventName, callback) {
        this._eventTarget.addEventListener(eventName, callback);
    }

    init() {
        this.isInit = true;
        this.initializeColumnsFromData();
        this.render();
    }

    initializeColumnsFromData() {
        if (this.options.autoGenerateField && this.container.dataset.initialize !== 'True') {
            // Asegurarnos de que this.data sea un array y tenga al menos un elemento
            if (!Array.isArray(this.data) || this.data.length === 0 || typeof this.data[0] !== 'object') {
                return;
            }

            // Conjunto de dataField ya existentes
            const existingFields = new Set(
                this.fields.map(col => col.name)
            );

            const _fields = [...this.fields];
            const keys = Object.keys(this.data[0]);

            // Recorremos solo las keys del primer objeto
            keys.filter(col => !existingFields.has(col)).forEach((fieldName) => {
                const field = { ...this.defaultFieldTemplate };
                field.name = fieldName;
                field.text = fieldName;
                field.order = keys.indexOf(fieldName);

                _fields.push(field);
            });

            this.fields = _fields;
        }

        // Ahora ordenamos this.columns por columnOrder ascendente
        this.fields.sort((a, b) => {
            const oa = typeof a.columnOrder === 'number' ? a.columnOrder : 0;
            const ob = typeof b.columnOrder === 'number' ? b.columnOrder : 0;
            return oa - ob;
        });

        this.container.dataset.initialize = 'True';
    }

    // renderizar los filtros
    render() {
        const div = document.createElement('div');
        div.className = 'btn-group';

        // Input
        const input = document.createElement('input');
        input.className = 'form-control rounded-0 rounded-start z-3 w-auto';
        if (this.options.size && typeof this.options.size === 'string') input.classList.add(`form-control-${this.options.size}`);
        input.id = `${this.container.id}_inputFiltro`;
        input.placeholder = this.options.texts.placeholder;
        input.autocomplete = 'off';
        input.type = this.options.filterType === this.eFilterType.Multiple ? 'search' : this.getInputType(this.fields[0].type || 'search');
        input.title = this.options.texts.title;
        input.setAttribute('aria-label', 'Filtro de busqueda');
        input.dataset.inputFilter = 'True';
        input.value = this.filterValue;

        if (input.dataset.initialize !== 'True') {
            input.addEventListener('input', (e) => {
                this.debouncedHandleFilterChange(e.target.value.trim());
            });
            input.dataset.initialize = 'True';
        }

        div.appendChild(input);

        const dropdown = document.createElement('div');
        dropdown.className = 'btn-group';

        const btn = this.elements.tigger;
        btn.type = 'button';
        btn.className = 'btn btn-secondary dropdown-toggle';
        if (this.options.size && typeof this.options.size === 'string') btn.classList.add(`btn-${this.options.size}`);
        btn.setAttribute('data-bs-toggle', 'dropdown');
        if (this.options.filterType === this.eFilterType.Multiple) btn.setAttribute('data-bs-auto-close', 'outside');
        btn.setAttribute('aria-expanded', 'false');

        btn.title = this.options.texts.titleDropdown;
        dropdown.appendChild(btn);

        const ul = this.elements.ul;
        ul.className = 'dropdown-menu dropdown-menu-lg-end';
        ul.setAttribute('data-bs-popper', 'static');

        if (ul.dataset.initialize !== 'True') {
            ul.addEventListener('click', (event) => {
                const clicked_li = event.target.closest("li");
                if (clicked_li) {
                    const checkbox = clicked_li.querySelector("input");
                    if (checkbox) {

                        // evita que quite todos los check cuando es multiple
                        if (this.options.filterType === this.eFilterType.Multiple) {
                            const selectedCols = this.filteredFields.length;
                            if (selectedCols <= this.options.minSelected && checkbox.checked) {
                                event.preventDefault();
                                event.stopPropagation();
                                return;
                            }

                            checkbox.checked = !checkbox.checked;

                            this.filteredFields = checkbox.checked
                                ? [...this.filteredFields, checkbox.value]
                                : this.filteredFields.filter(item => item !== checkbox.value);
                        } else {
                            checkbox.checked = true;
                            this.filteredFields = [checkbox.value];
                            const field = this.getFieldByName(checkbox.value);
                            const fieldType = this.getInputType(field.type);
                            if (fieldType && input.type !== fieldType)
                                input.type = fieldType;
                        }
                    }
                }
            });

            ul.dataset.initialize = 'True';
        }

        if (dropdown.dataset.initialize !== 'True') {
            dropdown.addEventListener('hide.bs.dropdown', () => {
                if (this.options.createLabel) this.elements.label.textContent = this.getSelectedFieldText();
                this.options.isOpen = false;
                this.riseEvent();
            });

            dropdown.addEventListener('show.bs.dropdown', () => {
                //this.positionDropdown();
                this.options.isOpen = true;
            });

            dropdown.dataset.initialize = 'True'
        }

        dropdown.appendChild(ul);

        // header
        const liHeader = document.createElement('li');
        liHeader.className = 'dropdown-header py-0';
        liHeader.textContent = this.options.texts.placeholderDropdown;
        liHeader.title = this.options.texts.titleDropdown;

        ul.appendChild(liHeader);

        // Divider
        const liDivider = document.createElement('li');
        const hrDivider = document.createElement('hr');
        hrDivider.className = 'dropdown-divider';

        liDivider.appendChild(hrDivider);
        ul.appendChild(liDivider);
        const isSingleSelect = this.options.filterType === this.eFilterType.Single;

        this.fields.filter(field => field.visible).forEach((field, index) => {
            const li = document.createElement('li');
            li.className = 'dropdown-item pointer';
            li.title = field.title || this.options.texts.titleOption;

            const name = `${this.container.id}_filter_otp`;
            const id = `${name}_${index}`;

            // radio
            const input = document.createElement('input');
            input.id = id;
            if (isSingleSelect) {
                input.type = 'radio';
                input.name = name;
                input.checked = this.options.isPostBack ? this.filteredFields.includes(field.name) : index === 0;
            } else {
                input.checked = this.options.isPostBack ? this.filteredFields.includes(field.name) : true;
                input.type = 'checkbox';
            }

            input.className = 'form-check-input me-1 pe-none';
            input.value = field.name;
            if (input.checked && !this.options.isPostBack) this.filteredFields.push(field.name);

            // label
            const label = document.createElement('label');
            label.setAttribute('for', id);
            label.className = 'form-check-label pe-none';
            label.textContent = field.text || field.name;

            li.appendChild(input);
            li.appendChild(label);
            ul.appendChild(li);
        });

        if (this.options.createLabel) {
            const label = this.elements.label;
            label.classList = 'form-label';
            label.textContent = this.getSelectedFieldText();
            label.setAttribute('for', `${this.container.id}_inputFiltro`);
            label.dataset.labelFilter = 'True';
            this.container.appendChild(label);
        }

        div.appendChild(dropdown);
        this.container.appendChild(div);

        if (this.options.isOpen) {
            const dropdownInstance = bootstrap.Dropdown.getOrCreateInstance(dropdown);
            dropdownInstance.show();
        }
    }

    getSelectedFieldText() {
        // Si no hay campos filtrados, retornar cadena vacía
        if (!this.filteredFields || this.filteredFields.length === 0) {
            return '';
        }

        // Si es filtro único, retornar el nombre del primer campo
        if (this.options.filterType === this.eFilterType.Single) {
            return this.filteredFields[0] || '';
        }

        // Si es filtro múltiple
        const selectedFields = this.filteredFields;

        // Si no hay maxLabelCount o no es un número, retornar todos los campos unidos
        if (!this.options.maxLabelCount || typeof this.options.maxLabelCount !== 'number') {
            return selectedFields.join(', ');
        }

        // Si la cantidad de campos no supera el máximo, retornar todos unidos
        if (selectedFields.length <= this.options.maxLabelCount) {
            return selectedFields.join(', ');
        }

        // Si supera el máximo, unir los primeros "maxLabelCount" campos y agregar "y X más"
        const firstFields = selectedFields.slice(0, this.options.maxLabelCount).join(', ');
        const remainingCount = selectedFields.length - this.options.maxLabelCount;
        return `${firstFields} y ${remainingCount} más`;
    }

    filterChangeValue(val) {
        this.filterValue = val;
        this.riseEvent();
    }

    riseEvent() {
        const data = { fields: this.filteredFields, value: this.filterValue }
        this.emit('filterChange', data);

        // manejo del PostBack
        if (this.options.autoPostBack && typeof __doPostBack === 'function') {
            const options = {
                isOpen: this.options.isOpen,
                label: this.elements.label.textContent || '',
                inputType: this.elements.input.type,
                data: data,
            };

            __doPostBack(this.container.dataset.name, `filterChange$${JSON.stringify(options)}`);
        }
    }

    getFieldByName(name) {
        if (typeof name !== 'string' || !name) {
            console.error('getNameByName: debes pasar un name válido (string).');
            return null;
        }

        // Buscamos
        const col = this.fields.find(c => c.name === name);
        return col || null;
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

    getInputType(fieldType) {
        let inputType;
        switch (fieldType) {
            case this.eFieldType.Text:
                inputType = 'search'
                break;
            case this.eFieldType.Number:
            case this.eFieldType.Decimal:
                inputType = 'number'
                break;
            case this.eFieldType.Date:
                inputType = 'date'
                break;
            case this.eFieldType.DateTime:
                inputType = 'datetime-local'
                break;

            default:
                inputType = 'search'
                break;
        }

        return inputType;
    }

    positionDropdown() {
        const { ul, input } = this.elements;

        const rect = input.getBoundingClientRect();
        ul.style.position = 'relative';
        ul.style.top = `${rect.bottom + window.scrollY}px`;
        ul.style.left = `${rect.left + window.scrollX}px`;
        ul.style.width = `${rect.width}px`;
    }
}