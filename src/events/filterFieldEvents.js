import {
    getSelectedFieldText,
    getSelectedFieldTitle,
    getFieldByName,
    getInputType,
    onceInitialize,
    getSelectAllState
} from '../utils/utils.js';
import { FilterType } from '../constants/enums.js';

/**
 * Configura los eventos del dropdown
 * @param {HTMLElement} dropdown - Elemento dropdown
 * @param {ZrFilterField} instance - Instancia de ZrFilterField
 * @returns {Function} Función para limpiar eventos
 */
export function setupDropdownEvents(dropdown, instance) {
    // Handler para cuando se oculta el dropdown
    const onHide = () => {
        if (instance.options.createLabel) {
            instance.elements.label.textContent = getSelectedFieldText(
                instance.fields,
                instance.filteredFields,
                instance.options
            );
            instance.elements.label.title = getSelectedFieldTitle(
                instance.fields,
                instance.filteredFields
            );
        }
        instance.options.isOpen = false;
        riseEvent('selectedChange', instance);
    };

    // Handler para cuando se muestra el dropdown
    const onShow = () => {
        instance.options.isOpen = true;
    };

    // Handler para clicks en items del dropdown
    const onClick = (event) => handleDropdownClick(event, instance);

    // Añadir event listeners
    onceInitialize(dropdown, () => {
        dropdown.addEventListener('hide.bs.dropdown', onHide);
        dropdown.addEventListener('show.bs.dropdown', onShow);
        dropdown.querySelector('ul')?.addEventListener('click', onClick);
    });

    // Retornar función de limpieza
    return () => {
        dropdown.removeEventListener('hide.bs.dropdown', onHide);
        dropdown.removeEventListener('show.bs.dropdown', onShow);
        dropdown.querySelector('ul').removeEventListener('click', onClick);
    };
}

/**
 * Maneja el click en items del dropdown
 * @param {Event} event - Evento de click
 * @param {ZrFilterField} instance - Instancia de ZrFilterField
 */
function handleDropdownClick(event, instance) {
    const clickedLi = event.target.closest('li');
    if (!clickedLi) return;

    const checkbox = clickedLi.querySelector('input');
    if (!checkbox) return;

    const isMultiple = instance.options.filterType === FilterType.Multiple;

    if (isMultiple) {
        const selectedCount = instance.filteredFields.length;
        if (checkbox.dataset.selectAll !== 'True' && ((selectedCount <= instance.options.minSelected && checkbox.checked) ||
            (instance.options.maxSelected && selectedCount >= instance.options.maxSelected && !checkbox.checked))) {
            event.preventDefault();
            event.stopPropagation();
            return;
        }

        if (clickedLi.dataset.selectAll === 'True') {
            handleAllSelection(checkbox, instance);
        } else {
            handleMultipleSelection(checkbox, instance);
        }
    } else {
        handleSingleSelection(checkbox, instance);
    }
}

// Helper para selección de todos
function handleAllSelection(checkbox, instance) {
    const isChecked = checkbox.dataset.checked === 'true';
    checkbox.checked = !isChecked; 
    checkbox.dataset.checked = !isChecked; // lo niego

    updateAllFilteredFields(checkbox, instance);
    updateIntermediate(instance);
}

// Helper para selección múltiple
function handleMultipleSelection(checkbox, instance) {
    checkbox.checked = !checkbox.checked;
    updateFilteredFields(checkbox, instance);
    updateIntermediate(instance);
}

// Helper para selección única
function handleSingleSelection(checkbox, instance) {
    checkbox.checked = true;
    instance.filteredFields = [checkbox.value];
    updateInputType(checkbox.value, instance);
}

// Helper para actualizar campos filtrados
function updateFilteredFields(checkbox, instance) {
    instance.filteredFields = checkbox.checked
        ? [...instance.filteredFields, checkbox.value]
        : instance.filteredFields.filter(f => f !== checkbox.value);
}

// Helper para actualizar campos filtrados
function updateAllFilteredFields(checkbox, instance) {
    const visibleFields = instance.getVisibleFields().map((f) => f.name);
    const checked = checkbox.checked;
    const min = instance.options.minSelected;
    const max = instance.options.maxSelected || visibleFields.length; // Valor por defecto: todos

    if (checked) {
        const fieldsToSelect = visibleFields.slice(0, max); // Corta el array hasta el máximo
        instance.filteredFields = fieldsToSelect;
    } else {
        const fieldsToSelect = visibleFields.slice(0, min); // Corta el array hasta el mínimo
        instance.filteredFields = fieldsToSelect;
    }

    // cambios los checked
    instance.elements.ul.querySelectorAll('input:not([data-select-all])').forEach(element => {
        element.checked = instance.filteredFields.includes(element.value);
    });
}

/**
 * Actualiza el estado visual de un checkbox "Select All"
 * @param {HTMLInputElement} checkbox - Elemento checkbox a actualizar
 * @param {Object} instance - Instancia que contiene fields y filteredFields
 */
function updateIntermediate(instance) {
    const checkbox = instance.elements.ul.querySelector('input[data-select-all]')

    if (!checkbox || !instance) {
        console.warn('Invalid parameters for updateSelectAllState');
        return;
    }

    const { isChecked, isIndeterminate } = getSelectAllState(
        instance.fields || [],
        instance.filteredFields || []
    );

    checkbox.checked = isChecked;
    checkbox.indeterminate = isIndeterminate;
}


// Helper para actualizar tipo de input
function updateInputType(fieldName, instance) {
    const field = getFieldByName(instance.fields, fieldName);
    const newType = getInputType(field.type);
    if (instance.elements.input.type !== newType) {
        instance.elements.input.type = newType;
    }
}

// Maneja los eventos change y el posback cuando es necesario
function riseEvent(eventName, instance) {
    let data;

    if (eventName === 'filterChange') {
        data = { fields: instance.filteredFields, value: instance.filterValue };
    } else {
       data = { fields: instance.filteredFields };
    }

    instance.emit(eventName, data);

    // manejo del PostBack
    if (instance.options.webForms.autoPostBack && typeof __doPostBack === 'function') {
        const options = {
            isOpen: instance.options.webForms.isOpen,
            label: sanitize(instance.elements.label.textContent || ''),
            inputType: instance.elements.input.type,
            data: sanitize(data),
        };

        __doPostBack(instance.container.getAttribute('name'), `${eventName}$${JSON.stringify(options)}`);
    }
}

/**
 * Crea y configura el handler debounce para el input de filtro
 * @param {ZrFilterField} instance - Instancia de ZrFilterField
 * @param {number} [delay=800] - Tiempo de debounce
 * @returns {Function} Función debounceada
 */
function createDebouncedHandler(instance, delay = 800) {
    /**
     * Maneja el cambio de valor del filtro
     * @param {string} val - Valor del input
     */
    const filterChangeValue = (val) => {
        instance.filterValue = val;
        riseEvent('filterChange', instance);
    };

    // Retornamos el debounce
    return debounce(filterChangeValue, delay);
}

/**
 * @param {HTMLInputElement} input - Elemento input
 * @param {ZrFilterField} instance - Instancia de ZrFilterField
 * @returns {Function} Función para limpiar eventos
 */
export function setupFilterInput(input, instance) {
    const debouncedHandler = createDebouncedHandler(instance);

    onceInitialize(input, () => {
        input.addEventListener('input', (e) => {
            debouncedHandler(e.target.value.trim());
        });
    });

    // Retornar función de limpieza
    return () => {
        input.removeEventListener('input', debouncedHandler);
    };
}

export function debounce(func, delay) {
    let timer;
    return function (...args) {
        clearTimeout(timer);
        timer = setTimeout(() => {
            func.apply(this, args);
        }, delay);
    };
}