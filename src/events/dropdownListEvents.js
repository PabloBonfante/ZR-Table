import {
    onceInitialize,
    getSelectAllState,
    getFieldByName
} from '../utils/utils.js';
import { FilterType } from '../constants/enums.js';

/**
 * Configura los eventos del dropdown
 * @param {HTMLElement} dropdown - Elemento dropdown
 * @param {ZrDropdownList} instance - Instancia de ZrDropdownList
 * @returns {Function} Función para limpiar eventos
 */
export function setupDropdownEvents(dropdown, instance) {
    // Handler para cuando se oculta el dropdown
    const onHide = () => {
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
 * @param {ZrDropdownList} instance - Instancia de ZrDropdownList
 */
function handleDropdownClick(event, instance) {
    const clickedLi = event.target.closest('li');
    if (!clickedLi) return;

    const checkbox = clickedLi.querySelector('input');
    if (!checkbox) return;

    const isMultiple = instance.options.filterType === FilterType.Multiple;

    if (isMultiple) {
        const selectedCount = instance.selecteds.length;
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

    updateAllFilteredFields(!isChecked, instance);
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
    instance.selecteds = [getFieldByName(instance.fields, checkbox.value)];
}

// Helper para actualizar campos filtrados
function updateFilteredFields(checkbox, instance) {
    instance.selecteds = checkbox.checked
        ? [...instance.selecteds, getFieldByName(instance.fields, checkbox.value)]
        : instance.selecteds.filter(f => f.name !== checkbox.value);
}


/**
 * Actualiza el estado visual de un checkbox "Select All"
 * @param {bool} isChecked - Indica si se debe marcar o desmarcar la lista
 * @param {ZrDropdownList} instance - Instancia de ZrDropdownList
 */

// Helper para actualizar los check
function updateAllFilteredFields(isChecked, instance) {
    const visibleFields = instance.getVisibleFields();
    const min = instance.options.minSelected;
    const max = instance.options.maxSelected || visibleFields.length; // Valor por defecto: todos

    if (isChecked) {
        const fieldsToSelect = visibleFields.slice(0, max); // Corta el array hasta el máximo
        instance.selecteds = fieldsToSelect;
    } else {
        const fieldsToSelect = visibleFields.slice(0, min); // Corta el array hasta el mínimo
        instance.selecteds = fieldsToSelect;
    }

    const selecteds = instance.selecteds.map((f) => f.name);

    // cambios los checked
    instance.elements.ul.querySelectorAll('input:not([data-select-all])').forEach(element => {
        element.checked = selecteds.includes(element.value);
    });
}

/**
 * Actualiza el estado visual de un checkbox "Select All"
 * @param {ZrDropdownList} instance - Instancia de ZrDropdownList
 */
function updateIntermediate(instance) {
    const checkbox = instance.elements.ul.querySelector('input[data-select-all]')

    if (!checkbox || !instance) {
        console.warn('Invalid parameters for updateSelectAllState');
        return;
    }

    const { isChecked, isIndeterminate } = getSelectAllState(
        instance.fields || [],
        instance.selecteds || []
    );

    checkbox.checked = isChecked;
    checkbox.indeterminate = isIndeterminate;
}

// Maneja los eventos change y el posback cuando es necesario
function riseEvent(eventName, instance) {
    const data = { fields: instance.selecteds };
    instance.emit(eventName, data);
}