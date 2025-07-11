import { FilterType, FieldType } from '../constants/enums.js';
import { defaultFieldTemplate, defaultOptions } from '../template/template.js';
import { validateEnum } from '../utils/validation.js';
import { setupDropdownEvents, setupFilterInput } from '../events/filterFieldEvents.js';
import {
    deepCopy,
    getInputType,
    getSelectedFieldText,
    getSelectedFieldTitle,
    initColumnsFromData,
} from '../utils/utils.js';
import {
    createInput,
    createDropdownItem,
    createHeaderDropdown,
    createDividerDropdown,
    createButtonDropdown,
    createBtnGroup,
    createDropdownMenu
} from '../render/domHelpers.js';

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
            ul: this.container.querySelector('ul') || createDropdownMenu(),
            tigger: this.container.querySelector('button') || createButtonDropdown(this.options),
            label: this.container.querySelector('label[data-label-filter="True"]') || document.createElement('label'),
        };

        this.filterValue = options.filterValue || '';
        this.filteredFields = options.filteredFields || [];
        this.isInit = false;
        this._eventTarget = new EventTarget();

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

        const group = createBtnGroup();
        group.appendChild(input);
        group.appendChild(dropdown);

        // Contenedor para serpara el label del grupo
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

        // Evento
        this._cleanupInputEvents = setupFilterInput(input, this);

        this.elements.input = input;
        return input;
    }

    createDropdown() {
        const Group = createBtnGroup();

        // Btn tigger
        Group.appendChild(this.elements.tigger);

        // elements
        const ul = this.createDropdownList();
        Group.appendChild(ul);

        // Eventos
        this._cleanupDropdownEvents = setupDropdownEvents(Group, this);

        return Group;
    }

    createDropdownList() {
        const ul = this.elements.ul;
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

    getVisibleFields() {
        return this.fields.filter(f => f.visible);
    }
}