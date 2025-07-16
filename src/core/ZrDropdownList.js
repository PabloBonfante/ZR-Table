import { FilterType, FieldType } from '../constants/enums.js';
import { defaultFieldTemplate, dropdownOptions } from '../template/template.js';
import { validateEnum } from '../utils/validation.js';
import { setupDropdownEvents } from '../events/dropdownListEvents.js';
import {
    deepCopy,
    initColumnsFromData,
    getSelectAllState,
    onceInitialize
} from '../utils/utils.js';
import {
    createDropdownItem,
    createHeaderDropdown,
    createDividerDropdown,
    createButtonDropdown,
    createBtnGroup,
    createDropdownMenu,
    createDropdownItemSelectAll
} from '../render/domHelpers.js';

export class ZrDropdownList {
    constructor(containerId, data, options = {}) {
        this.container = document.getElementById(containerId);
        this.data = data;
        this.options = deepCopy({ ...dropdownOptions }, options);
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
            ul: this.container.querySelector('ul') || createDropdownMenu(),
            tigger: this.container.querySelector('button') || createButtonDropdown(this.options),
        };

        this.selecteds = options.selecteds || [];
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
        console.log(this.selecteds);
    }

    initializeColumnsFromData() {
        onceInitialize(this.container, () => {
            if (this.options.autoGenerateField) this.fields = initColumnsFromData(this.fields, this.data);
        });
    }

    render() {
        const dropdown = this.createDropdown();
        this.container.appendChild(dropdown);
    }

    createDropdown() {
        const Group = this.options.createBtnGroup ? createBtnGroup() : createBtnGroup('dropdown');
        if (this.options.texts.titleDropdown) Group.title = this.options.texts.titleDropdown;

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
        const divider = createDividerDropdown();
        ul.appendChild(divider);

        // creo y renderizo los elementos del ul
        this.rederListElements(ul, divider);
        return ul;
    }

    rederListElements(ul, divider) {
        const isSingleSelect = this.options.filterType === FilterType.Single;

        this.getVisibleFields().forEach((field, index) => {
            const isChecked = field.checked !== undefined ? field.checked : this.isFieldChecked(index, isSingleSelect);
            const li = createDropdownItem(
                field,
                field.title || this.options.texts.titleOption || '',
                index,
                this.container.id,
                isSingleSelect,
                isChecked
            );

            if (isChecked) {
                if (isSingleSelect) {
                    // Solo existe un seleccionado
                    this.selecteds = [field];
                } else {
                    this.selecteds.push(field);
                }
            }

            ul.appendChild(li);
        });

        if (!isSingleSelect) {
            const statesCheck = getSelectAllState(this.fields, this.selecteds);

            ul.insertBefore(
                createDropdownItemSelectAll(
                    this.options.texts.textSelectAll,
                    this.options.texts.titleSelectAll,
                    this.container.id,
                    statesCheck.isChecked,
                    statesCheck.isIndeterminate
                ), divider);
        }
    }

    isFieldChecked(index, isSingleSelect) {
        return isSingleSelect ? index === 0 : true;
    }

    getVisibleFields() {
        return this.fields.filter(f => f.visible);
    }
}