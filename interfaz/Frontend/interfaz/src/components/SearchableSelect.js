import React from 'react';
import Select from 'react-select';

// El menú se monta en <body> para que no lo recorten contenedores con overflow ni diálogos fijos
export const portalSelectProps = {
    menuPortalTarget: typeof document !== 'undefined' ? document.body : null,
    menuPlacement: 'auto',
};

export const portalMenuStyle = (base) => ({ ...base, zIndex: 10000 });

const SearchableSelect = ({ options, value, onChange, placeholder, isMulti = false, noOptionsMessage = 'No hay coincidencias' }) => {
    const list = options || [];
    const selected = isMulti
        ? list.filter(option => (value || []).map(String).includes(String(option.value)))
        : list.find(option => String(option.value) === String(value)) || null;

    return (
        <Select
            {...portalSelectProps}
            options={list}
            value={selected}
            onChange={option => {
                if (isMulti) {
                    onChange((option || []).map(item => item.value));
                    return;
                }
                onChange(option ? option.value : '');
            }}
            placeholder={placeholder}
            isClearable
            isSearchable
            isMulti={isMulti}
            noOptionsMessage={() => noOptionsMessage}
            styles={{
                control: (base) => ({ ...base, minHeight: 32, fontSize: 12 }),
                menu: (base) => ({ ...base, fontSize: 12 }),
                menuPortal: portalMenuStyle,
                valueContainer: (base) => ({
                    ...base,
                    padding: '0 6px',
                    ...(isMulti ? { flexWrap: 'wrap', maxHeight: 120, overflowY: 'auto' } : {}),
                }),
                multiValue: (base) => ({ ...base, maxWidth: '100%' }),
                multiValueLabel: (base) => ({ ...base, whiteSpace: 'normal', overflowWrap: 'anywhere' }),
            }}
        />
    );
};

export default SearchableSelect;
