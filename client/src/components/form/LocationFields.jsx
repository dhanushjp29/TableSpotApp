import { City, Country, State } from "country-state-city";
import { useMemo, useState } from "react";

import SearchableSelect from "./SearchableSelect.jsx";

const ALL_COUNTRIES = Country.getAllCountries();
const ALL_STATES = State.getAllStates();
const ALL_CITIES = City.getAllCities();

const countryLabel = (c) => (c.flag ? `${c.flag} ${c.name}` : c.name);

function LocationFields({ value = {}, onChange, errors = {}, disabled = false }) {
  const [country, setCountry] = useState(() => {
    const name = (value.country || "").trim();
    if (!name) return null;
    return (
      ALL_COUNTRIES.find((c) => c.name.toLowerCase() === name.toLowerCase()) || null
    );
  });
  const [state, setState] = useState(() => {
    const name = (value.state || "").trim();
    if (!name) return null;
    return (
      ALL_STATES.find(
        (s) =>
          s.name.toLowerCase() === name.toLowerCase() &&
          (!country || s.countryCode === country.isoCode)
      ) || null
    );
  });
  const [city, setCity] = useState(() => {
    const name = (value.city || "").trim();
    if (!name) return null;
    const match = ALL_CITIES.find(
      (c) =>
        c.name.toLowerCase() === name.toLowerCase() &&
        (!state || (c.stateCode === state.isoCode && c.countryCode === state.countryCode)) &&
        (!country || c.countryCode === country.isoCode)
    );
    return match || null;
  });

  const emit = (nCountry, nState, nCity) => {
    onChange({
      country: nCountry?.name || "",
      state: nState?.name || "",
      city: nCity?.name || "",
    });
  };

  const countryOptions = useMemo(
    () => ALL_COUNTRIES.map((c) => ({ key: c.isoCode, label: countryLabel(c), value: c })),
    []
  );

  const stateOptions = useMemo(
    () =>
      (country ? State.getStatesOfCountry(country.isoCode) : ALL_STATES).map((s) => ({
        key: `${s.countryCode}-${s.isoCode}`,
        label: s.name,
        value: s,
      })),
    [country]
  );

  const cityOptions = useMemo(() => {
    let cities;
    if (state) cities = City.getCitiesOfState(state.countryCode, state.isoCode);
    else if (country) cities = City.getCitiesOfCountry(country.isoCode) || [];
    else cities = ALL_CITIES;

    return cities.map((c) => ({
      key: `${c.countryCode}-${c.stateCode}-${c.name}`,
      label: c.name,
      value: c,
    }));
  }, [state, country]);

  const handleCountryChange = (next) => {
    const n = next || null;
    let nState = state;
    let nCity = city;
    if (nState && (!n || nState.countryCode !== n.isoCode)) nState = null;
    if (nCity && (!n || nCity.countryCode !== n.isoCode)) nCity = null;
    setCountry(n);
    setState(nState);
    setCity(nCity);
    emit(n, nState, nCity);
  };

  const handleStateChange = (next) => {
    const n = next || null;
    let nCountry = country;
    let nCity = city;
    if (n) {
      if (!nCountry || nCountry.isoCode !== n.countryCode) {
        nCountry = Country.getCountryByCode(n.countryCode) || null;
      }
      if (
        nCity &&
        (nCity.stateCode !== n.isoCode || nCity.countryCode !== n.countryCode)
      ) {
        nCity = null;
      }
    }
    setState(n);
    setCountry(nCountry);
    setCity(nCity);
    emit(nCountry, n, nCity);
  };

  const handleCityChange = (next) => {
    const n = next || null;
    let nCountry = country;
    let nState = state;
    if (n) {
      nCountry = Country.getCountryByCode(n.countryCode) || null;
      nState = State.getStateByCodeAndCountry(n.stateCode, n.countryCode) || null;
    }
    setCity(n);
    setState(nState);
    setCountry(nCountry);
    emit(nCountry, nState, n);
  };

  return (
    <div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <SearchableSelect
          label="Country *"
          placeholder="Select / Search Country"
          options={countryOptions}
          value={country || null}
          onChange={handleCountryChange}
          error={errors.country}
          disabled={disabled}
        />
        <SearchableSelect
          label="State *"
          placeholder="Select / Search State"
          options={stateOptions}
          value={state || null}
          onChange={handleStateChange}
          error={errors.state}
          disabled={disabled}
        />
        <SearchableSelect
          label="City *"
          placeholder="Select / Search City"
          options={cityOptions}
          value={city || null}
          onChange={handleCityChange}
          error={errors.city}
          disabled={disabled}
        />
      </div>
      <p className="mt-1.5 text-xs text-muted">
        Start from any field — Country, State or City — the others sync automatically.
      </p>
    </div>
  );
}

export default LocationFields;
