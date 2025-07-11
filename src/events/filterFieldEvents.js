import {
    getSelectedFieldText,
    getSelectedFieldTitle,
    getFieldByName,
    getInputType,
    onceInitialize
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
        riseEvent(instance);
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

        if ((selectedCount <= instance.options.minSelected && checkbox.checked) ||
            (instance.options.maxSelected && selectedCount >= instance.options.maxSelected && !checkbox.checked)) {
            event.preventDefault();
            event.stopPropagation();
            return;
        }

        handleMultipleSelection(checkbox, instance);
    } else {
        handleSingleSelection(checkbox, instance);
    }
}

// Helper para selección múltiple
function handleMultipleSelection(checkbox, instance) {
    checkbox.checked = !checkbox.checked;
    updateFilteredFields(checkbox, instance);
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

// Helper para actualizar tipo de input
function updateInputType(fieldName, instance) {
    const field = getFieldByName(instance.fields, fieldName);
    const newType = getInputType(field.type);
    if (instance.elements.input.type !== newType) {
        instance.elements.input.type = newType;
    }
}

// Maneja los eventos change y el posback cuando es necesario
function riseEvent(instance) {
    const data = { fields: instance.filteredFields, value: instance.filterValue }
    instance.emit('filterChange', data);

    // manejo del PostBack
    if (instance.options.webForms.autoPostBack && typeof __doPostBack === 'function') {
        const options = {
            isOpen: instance.options.webForms.isOpen,
            label: sanitize(instance.elements.label.textContent || ''),
            inputType: instance.elements.input.type,
            data: sanitize(data),
        };

        __doPostBack(instance.container.getAttribute('name'), `filterChange$${JSON.stringify(options)}`);
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
        riseEvent(instance);
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