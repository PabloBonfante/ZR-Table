import { FilterType, FieldType } from '../constants/enums.js';
import { defaultFieldTemplate, defaultOptions } from '../template/template.js';
import { validateEnum } from '../utils/validation.js';
import { getFieldByName, deepCopy, debounce, getInputType, getSelectedFieldText, getSelectedFieldTitle, initColumnsFromData, onceInitialize, sanitize } from '../utils/utils.js';
import { createInput, createDropdownItem, createHeaderDropdown, createDividerDropdown, createButtonDropdown } from '../render/domHelpers.js';

export class ZrFilterField {
    constructor(containerId, data, options = {}) {
        this.container = document.getElementById(containerId);
        this.data = data;
        this.options = deepCopy({ ...defaultOptions }, options);
        this.options.filterType = validateEnum('filterType', this.options.filterType, FilterType, FilterType.Multiple);

        this.fields = Array.isArray(options.fields)
            ? options.fields
                .filter(col => col && typeof col.name === 'string')
                .map(col => {
                    const column = deepCopy({ ...defaultFieldTemplate }, col);
                    column.type = validateEnum('fieldType', column.type, FieldType, FieldType.Text);
                    return column;
                })
            : [];

        this.elements = {
            input: this.container.querySelector('input[data-input-filter="True"]') || document.createElement('input'),
            ul: this.container.querySelector('ul') || document.createElement('ul'),
            tigger: this.container.querySelector('button') || createButtonDropdown(this.options),
            label: this.container.querySelector('label[data-label-filter="True"]') || document.createElement('label'),
        };

        this.filterValue = options.filterValue || '';
        this.filteredFields = options.filteredFields || [];
        this.isInit = false;
        this._eventTarget = new EventTarget();

        // Método debounce
        this.debouncedHandleFilterChange = debounce(this.filterChangeValue.bind(this), 800);

        if ((this.data || this.options.fields) && !this.isInit) {
            this.init();
        }
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
        if (this.options.autoGenerateField && this.container.dataset.initialize !== 'True')
            this.fields = initColumnsFromData(this.fields, this.data);

        this.container.dataset.initialize = 'True';
    }

    render() {
        const input = this.createInput();
        const dropdown = this.createDropdown();

        if (this.options.createLabel) {
            this.renderLabel(input.id);
        }

        const group = document.createElement('div');
        group.className = 'btn-group';
        group.appendChild(input);
        group.appendChild(dropdown);

        const div = document.createElement('div');

        div.appendChild(group);
        this.container.appendChild(div);
        this.openIfRequired(dropdown);
    }

    createInput() {
        const input = createInput(
            `${this.container.id}_inputFiltro`,
            this.options.filterType === FilterType.Multiple
                ? 'search'
                : getInputType(this.fields[0]?.type || 'search'),
            'form-control rounded-0 rounded-start z-3 w-auto',
            this.options.texts.placeholder,
            this.options.texts.title
        );

        if (this.options.styleSize && typeof this.options.styleSize === 'string') {
            input.classList.add(`form-control-${this.options.styleSize}`);
        }

        input.dataset.inputFilter = 'True';
        input.value = this.options.webForms.inputValue || '';

        onceInitialize(input, () => {
            input.addEventListener('input', (e) => {
                this.debouncedHandleFilterChange(e.target.value.trim());
            });
        });

        this.elements.input = input;
        return input;
    }

    createDropdown() {
        const dropdown = document.createElement('div');
        dropdown.className = 'btn-group';

        // Btn
        dropdown.appendChild(this.elements.tigger);

        const ul = this.createDropdownList();
        dropdown.appendChild(ul);

        onceInitialize(dropdown, () => {
            dropdown.addEventListener('hide.bs.dropdown', () => {
                if (this.options.createLabel) {
                    this.elements.label.textContent = getSelectedFieldText(this.fields, this.filteredFields, this.options);
                    this.elements.label.title = getSelectedFieldTitle(this.fields, this.filteredFields);
                }
                this.options.isOpen = false;
                this.riseEvent();
            });

            dropdown.addEventListener('show.bs.dropdown', () => {
                this.options.isOpen = true;
            });
        });

        return dropdown;
    }

    handleDropdownClick(event) {
        const clickedLi = event.target.closest('li');
        if (!clickedLi) return;

        const checkbox = clickedLi.querySelector('input');
        if (!checkbox) return;

        const isMultiple = this.options.filterType === FilterType.Multiple;

        if (isMultiple) {
            const selectedCount = this.filteredFields.length;

            if (((selectedCount <= this.options.minSelected && checkbox.checked) ||
                (this.options.maxSelected && selectedCount >= this.options.maxSelected && !checkbox.checked))) {
                event.preventDefault();
                event.stopPropagation();
                return;
            }

            checkbox.checked = !checkbox.checked;

            this.filteredFields = checkbox.checked
                ? [...this.filteredFields, checkbox.value]
                : this.filteredFields.filter(f => f !== checkbox.value);
        } else {
            checkbox.checked = true;
            this.filteredFields = [checkbox.value];

            const field = getFieldByName(this.fields, checkbox.value);
            const newType = getInputType(field.type);
            if (this.elements.input.type !== newType)
                this.elements.input.type = newType;
        }
    }

    createDropdownList() {
        const ul = this.elements.ul;
        ul.className = 'dropdown-menu dropdown-menu-lg-end';
        ul.setAttribute('data-bs-popper', 'static');

        onceInitialize(ul, () => {
            ul.addEventListener('click', this.handleDropdownClick.bind(this));
        });

        ul.innerHTML = ''; // Limpia por si se vuelve a renderizar
        ul.appendChild(createHeaderDropdown(this.options.texts));
        ul.appendChild(createDividerDropdown());

        const isSingleSelect = this.options.filterType === FilterType.Single;

        this.getVisibleFields().forEach((field, index) => {
            const isChecked = this.isFieldChecked(field.name, index, isSingleSelect);
            const li = createDropdownItem(
                field,
                field.title || this.options.texts.titleOption || '',
                index,
                this.container.id,
                isSingleSelect,
                isChecked
            );

            if (isChecked && !this.options.webForms.isPostBack) {
                this.filteredFields.push(field.name);
            }

            ul.appendChild(li);
        });

        return ul;
    }

    renderLabel(forId) {
        const label = this.elements.label;
        label.className = 'form-label';
        label.textContent = getSelectedFieldText(this.fields, this.filteredFields, this.options);
        label.title = getSelectedFieldTitle(this.fields, this.filteredFields);
        label.setAttribute('for', forId);
        label.dataset.labelFilter = 'True';

        this.container.appendChild(label);
    }

    openIfRequired(dropdown) {
        if (this.options.webForms.isOpen) {
            const instance = bootstrap.Dropdown.getOrCreateInstance(dropdown);
            instance.show();
        }
    }

    isFieldChecked(fieldName, index, isSingleSelect) {
        if (this.options.webForms.isPostBack)
            return this.filteredFields.includes(fieldName);

        return isSingleSelect ? index === 0 : true;
    }

    filterChangeValue(val) {
        this.filterValue = val;
        this.riseEvent();
    }

    riseEvent() {
        const data = { fields: this.filteredFields, value: this.filterValue }
        this.emit('filterChange', data);

        // manejo del PostBack
        if (this.options.webForms.autoPostBack && typeof __doPostBack === 'function') {
            const options = {
                isOpen: this.options.webForms.isOpen,
                label: sanitize(this.elements.label.textContent || ''),
                inputType: this.elements.input.type,
                data: sanitize(data),
            };

            __doPostBack(this.container.getAttribute('name'), `filterChange$${JSON.stringify(options)}`);
        }
    }

    getVisibleFields() {
        return this.fields.filter(f => f.visible);
    }
}