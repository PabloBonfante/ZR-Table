import { FilterType, FieldType } from '../constants/enums.js';
import { defaultFieldTemplate } from '../template/template.js';

export function getFieldByName(fields, name) {
    if (!fields || !Array.isArray(fields) && typeof name !== 'string' || !name) {
        console.error('getNameByName: debes pasar un name válido (string).');
        return null;
    }

    const col = fields.find(c => c.name === name);
    return col || null;
}

export function deepCopy(target, source) {
    for (const key in source) {
        if (
            source[key] &&
            typeof source[key] === 'object' &&
            !Array.isArray(source[key])
        ) {
            if (!target[key] || typeof target[key] !== 'object') {
                target[key] = {};
            }
            deepCopy(target[key], source[key]);
        } else {
            target[key] = source[key];
        }
    }
    return target;
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

export function getInputType(fieldType) {
    let inputType;
    switch (fieldType) {
        case FieldType.Text:
            inputType = 'search'
            break;
        case FieldType.Number:
        case FieldType.Decimal:
            inputType = 'number'
            break;
        case FieldType.Date:
            inputType = 'date'
            break;
        case FieldType.DateTime:
            inputType = 'datetime-local'
            break;

        default:
            inputType = 'search'
            break;
    }

    return inputType;
}

export function getSelectedFieldText(fields, filteredFields, options) {
    // Si no hay campos filtrados, retornar cadena vacía
    if (!filteredFields || filteredFields.length === 0)
        return '';

    // Respeto el orden en que el usuario cargo los campos
    const selectedFields = filteredFields
    .map(name => {
        const field = fields.find(f => f.name === name);
        return field ? (field.text || field.name) : name;
    });

    // Si es filtro único, retornar el nombre del primer campo
    if (options.filterType === FilterType.Single)
        return selectedFields[0];

    // Si no existe un maximo o es menor la cantidad de campos, retornar todos
    if (!options.maxLabelCount || selectedFields.length <= options.maxLabelCount)
        return selectedFields.join(', ');

    // Si supera el máximo
    const firstFields = selectedFields.slice(0, options.maxLabelCount).join(', ');
    const remainingCount = selectedFields.length - options.maxLabelCount;
    return `${firstFields} y ${remainingCount} más`;
}

export function getSelectedFieldTitle(fields, filteredFields) {
    // Si no hay campos filtrados, retornar cadena vacía
    if (!filteredFields || filteredFields.length === 0)
        return '';

    // Respeto el orden en que el usuario cargo los campos
    const selectedFields = filteredFields
    .map(name => {
        const field = fields.find(f => f.name === name);
        return field ? (field.text || field.name) : name;
    });

    return `Filtrar por: ${selectedFields.join(', ')}`;
}

export function initColumnsFromData(fields, data) {
    if (!fields) return;

    const existingFields = new Set(fields.map(col => col.name));
    const _fields = [...fields];

    if (Array.isArray(data) && data.length > 0 && typeof data[0] === 'object') {
        const keys = Object.keys(data[0]);

        // Recorremos solo las keys del primer objeto
        keys.filter(col => !existingFields.has(col)).forEach((fieldName) => {
            const field = { ...defaultFieldTemplate };
            field.name = fieldName;
            field.text = fieldName;
            field.order = keys.indexOf(fieldName);

            _fields.push(field);
        });
    }

    // Ahora ordenamos columns por columnOrder ascendente
    _fields.sort((a, b) => {
        const oa = typeof a.order === 'number' ? a.order : 0;
        const ob = typeof b.order === 'number' ? b.order : 0;
        return oa - ob;
    });

    return _fields;
}

export function onceInitialize(el, callback) {
    if (el.dataset.initialize === 'True') return;
    callback();
    el.dataset.initialize = 'True';
}

export function sanitize(data) {
    if (Array.isArray(data)) {
        return data.map(sanitize);
    } else if (typeof data === 'object' && data !== null) {
        const sanitized = {};
        for (const key in data) {
            sanitized[key] = sanitize(data[key]);
        }
        return sanitized;
    } else if (typeof data === 'string') {
        return data
            .normalize('NFD')                // descompone caracteres acentuados
            .replace(/[\u0300-\u036f]/g, '') // remueve diacríticos
            .replace(/[\n\r\t]/g, ' ')       // remover saltos de línea/tabulaciones
            .replace(/["'{}\[\]]/g, '')      // elimina ", ', {, }, [, ]
            .trim();                         // eliminar espacios innecesarios
    } else {
        return data;
    }
}
