import {
    getSelectedFieldText,
    getSelectedFieldTitle,
    getInputType,
    onceInitialize,
} from '../utils/utils.js';

import { FilterType, InputType } from '../constants/enums.js'

/**
 * Configura los eventos del dropdown
 * @param {ZrFilterField} instance - Instancia de ZrFilterField
 */
export function setupDropdownEvents(instance) {
    instance.DropdownList.on('selectedChange', (event) => {
        debugger;
        console.log('selectedChange:', event.detail.fields);
        instance.filteredFields = event.detail.fields;

        if (instance.options.filterType === FilterType.Single) {
            updateInputType(instance);
        }

        updateLabel(instance);
    });
}


// Helper para actualizar tipo de input
function updateInputType(instance) {
    const fieldType = instance.fields[0]?.type || InputType.Search;
    const newType = getInputType(fieldType);
    if (instance.elements.input.type !== newType) {
        instance.elements.input.type = newType;
    }
}

export function updateLabel(instance) {
    const label = instance.elements.label;
    label.textContent = getSelectedFieldText(instance.fields, instance.filteredFields, instance.options);
    label.title = getSelectedFieldTitle(instance.fields, instance.filteredFields);
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