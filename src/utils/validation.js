export function validateEnum(paramName, value, enumObj, defaultValue) {
    if (value === undefined || value === null) {
        return defaultValue;
    }

    const validValues = Object.values(enumObj);
    if (validValues.includes(value)) {
        return value;
    }

    console.error(`El parámetro ${paramName} tiene un valor inválido: "${value}". Opciones válidas: [${validValues.join(', ')}]`);
    return defaultValue;
}