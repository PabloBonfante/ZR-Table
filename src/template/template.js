import { FilterType, FieldType } from '../constants/enums.js';

export const defaultFieldTemplate = {
    name: undefined,
    text: '',
    title: '',
    type: FieldType.Text,
    visible: true,
    checked: false,
    order: 0
};

export const defaultOptions = {
    filterType: FilterType.Multiple,
    autoGenerateField: true,
    createLabel: false,
    minSelected: 1,
    maxSelected: undefined,
    maxLabelCount: undefined,
    styleSize: undefined,

    webForms: {
        autoPostBack: false,
        isPostBack: false,
        inputValue: undefined,
        isOpen: false,
    },

    texts: {
        placeholder: 'Buscar...',
        title: 'Ingrese un valor a buscar',
        placeholderDropdown: 'Campos a filtrar',
        titleDropdown: 'Seleccione los campos a filtrar',
        titleOption: 'Seleccionar campo',
        textSelectAll: 'Seleccionar todos',
        titleSelectAll: 'Seleccionar todos los campos'
    }
};