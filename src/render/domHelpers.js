import { FilterType } from '../constants/enums.js';

export function createInput(id, type, className, placeholder, title) {
    const input = document.createElement('input');
    input.className = className;
    input.id = id;
    input.placeholder = placeholder;
    input.type = type;
    if (title) input.title = title;
    input.autocomplete = 'off';
    input.setAttribute('aria-label', 'Filtro de busqueda');
    return input;
}

export function createDropdownItem(field, title, index, containerId, isSingleSelect, isChecked) {
    const li = document.createElement('li');
    li.className = 'dropdown-item pointer';
    if (title && title !== '') li.title = title;

    const input = document.createElement('input');
    input.id = `${containerId}_filter_opt_${index}`;
    input.type = isSingleSelect ? 'radio' : 'checkbox';
    if (isSingleSelect) input.name = `${containerId}_filter_opt`;
    input.checked = isChecked;
    input.className = 'form-check-input me-1 pe-none';
    input.value = field.name;

    const label = document.createElement('label');
    label.setAttribute('for', input.id);
    label.className = 'form-check-label pe-none';
    label.textContent = field.text || field.name;

    li.appendChild(input);
    li.appendChild(label);

    return li;
}

export function createDropdownItemSelectAll(text, title, containerId, isChecked, isIntermediate) {
    const li = document.createElement('li');
    li.className = 'dropdown-item pointer';
    if (title && title !== '') li.title = title;
    li.dataset.selectAll = 'True';

    const input = document.createElement('input');
    input.id = `${containerId}_filter_opt_SelectAll`;
    input.type = 'checkbox';
    input.checked = isChecked;
    input.dataset.checked = isChecked;
    input.indeterminate = isIntermediate;
    input.className = 'form-check-input me-1 pe-none';
    input.value = 'SelectAll';
    input.dataset.selectAll = 'True';

    const label = document.createElement('label');
    label.setAttribute('for', input.id);
    label.className = 'form-check-label pe-none';
    label.textContent = text;

    li.appendChild(input);
    li.appendChild(label);

    return li;
}


export function createHeaderDropdown(texts) {
    if (!texts || typeof texts !== 'object') return;

    const liHeader = document.createElement('li');
    liHeader.className = 'dropdown-header py-0';
    liHeader.textContent = texts.headerText;
    if (texts.titleDropdown) liHeader.title = texts.titleDropdown;

    return liHeader
}

export function createDividerDropdown() {
    const liDivider = document.createElement('li');
    const hrDivider = document.createElement('hr');
    hrDivider.className = 'dropdown-divider';
    liDivider.appendChild(hrDivider);

    return liDivider;
}


export function createButtonDropdown(options) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'btn btn-secondary dropdown-toggle';
    if (options.styleSize && typeof options.styleSize === 'string') btn.classList.add(`btn-${options.styleSize}`);
    btn.setAttribute('data-bs-toggle', 'dropdown');
    btn.setAttribute('aria-expanded', 'false');
    if (options.texts.titleDropdown) btn.title = options.texts.titleDropdown;
    if (options.filterType === FilterType.Multiple) btn.setAttribute('data-bs-auto-close', 'outside');

    return btn;
}

export function createBtnGroup(className = 'btn-group') {
    const group = document.createElement('div');
    group.className = className;

    return group;
}

export function createDropdownMenu() {
    const ul = document.createElement('ul');
    ul.className = 'dropdown-menu dropdown-menu-lg-end';
    ul.setAttribute('data-bs-popper', 'static');

    return ul;
}

