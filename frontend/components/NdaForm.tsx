"use client";

import { useState, type ReactNode } from "react";
import { MAX_YEARS, MIN_YEARS, parseYears, type NdaValues, type Party } from "@/lib/nda";

type Props = {
  values: NdaValues;
  onChange: (values: NdaValues) => void;
};

const controlClass =
  "rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900 shadow-sm focus:border-blue-600 focus:outline-none focus:ring-1 focus:ring-blue-600";
const inputClass = `${controlClass} w-full`;

function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label className="block space-y-1">
      <span className="text-sm font-medium text-neutral-800">{label}</span>
      {hint && <span className="block text-xs text-neutral-500">{hint}</span>}
      {children}
    </label>
  );
}

function Fieldset({ legend, children }: { legend: string; children: ReactNode }) {
  return (
    <fieldset className="space-y-4 border-t border-neutral-200 pt-5">
      <legend className="pr-2 text-xs font-semibold uppercase tracking-wide text-neutral-500">
        {legend}
      </legend>
      {children}
    </fieldset>
  );
}

function YearsInput({
  value,
  disabled,
  onChange,
  label,
}: {
  value: number;
  disabled: boolean;
  onChange: (years: number) => void;
  label: string;
}) {
  // Keep the raw text locally so the field can be cleared while typing; only valid numbers are
  // committed, and blurring restores the committed value.
  const [text, setText] = useState(String(value));
  return (
    <input
      type="number"
      min={MIN_YEARS}
      max={MAX_YEARS}
      aria-label={label}
      className={`${controlClass} w-20 disabled:bg-neutral-100 disabled:text-neutral-400`}
      value={text}
      disabled={disabled}
      onChange={(e) => {
        setText(e.target.value);
        const years = parseYears(e.target.value);
        if (years !== null) onChange(years);
      }}
      onBlur={() => setText(String(value))}
    />
  );
}

export function NdaForm({ values, onChange }: Props) {
  const set = <K extends keyof NdaValues>(key: K, value: NdaValues[K]) =>
    onChange({ ...values, [key]: value });

  const partyFields = (key: "party1" | "party2", legend: string) => {
    const party = values[key];
    const setParty = (field: keyof Party, value: string) => set(key, { ...party, [field]: value });
    return (
      <Fieldset legend={legend}>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Company">
            <input className={inputClass} value={party.company} onChange={(e) => setParty("company", e.target.value)} />
          </Field>
          <Field label="Signer name">
            <input className={inputClass} value={party.name} onChange={(e) => setParty("name", e.target.value)} />
          </Field>
          <Field label="Signer title">
            <input className={inputClass} value={party.title} onChange={(e) => setParty("title", e.target.value)} />
          </Field>
          <Field label="Notice address">
            <input
              className={inputClass}
              placeholder="Email or postal address"
              value={party.noticeAddress}
              onChange={(e) => setParty("noticeAddress", e.target.value)}
            />
          </Field>
        </div>
      </Fieldset>
    );
  };

  return (
    <form className="space-y-6" onSubmit={(e) => e.preventDefault()}>
      <Fieldset legend="Agreement">
        <Field label="Purpose" hint="How Confidential Information may be used">
          <textarea
            rows={3}
            className={inputClass}
            value={values.purpose}
            onChange={(e) => set("purpose", e.target.value)}
          />
        </Field>
        <Field label="Effective date">
          <input
            type="date"
            className={inputClass}
            value={values.effectiveDate}
            onChange={(e) => set("effectiveDate", e.target.value)}
          />
        </Field>
      </Fieldset>

      <Fieldset legend="MNDA term">
        <p className="text-xs text-neutral-500">The length of this MNDA</p>
        <div className="flex items-center gap-2 text-sm">
          <input
            type="radio"
            id="mnda-expires"
            name="mndaTermType"
            checked={values.mndaTermType === "expires"}
            onChange={() => set("mndaTermType", "expires")}
          />
          <label htmlFor="mnda-expires">Expires</label>
          <YearsInput
            label="MNDA term in years"
            value={values.mndaTermYears}
            disabled={values.mndaTermType !== "expires"}
            onChange={(years) => set("mndaTermYears", years)}
          />
          <span>year(s) from the effective date</span>
        </div>
        <div className="flex items-center gap-2 text-sm">
          <input
            type="radio"
            id="mnda-until-terminated"
            name="mndaTermType"
            checked={values.mndaTermType === "untilTerminated"}
            onChange={() => set("mndaTermType", "untilTerminated")}
          />
          <label htmlFor="mnda-until-terminated">Continues until terminated</label>
        </div>
      </Fieldset>

      <Fieldset legend="Term of confidentiality">
        <p className="text-xs text-neutral-500">How long Confidential Information is protected</p>
        <div className="flex items-center gap-2 text-sm">
          <input
            type="radio"
            id="confidentiality-years"
            name="confidentialityTermType"
            checked={values.confidentialityTermType === "years"}
            onChange={() => set("confidentialityTermType", "years")}
          />
          <YearsInput
            label="Term of confidentiality in years"
            value={values.confidentialityTermYears}
            disabled={values.confidentialityTermType !== "years"}
            onChange={(years) => set("confidentialityTermYears", years)}
          />
          <label htmlFor="confidentiality-years">year(s) from the effective date</label>
        </div>
        <div className="flex items-center gap-2 text-sm">
          <input
            type="radio"
            id="confidentiality-perpetual"
            name="confidentialityTermType"
            checked={values.confidentialityTermType === "perpetual"}
            onChange={() => set("confidentialityTermType", "perpetual")}
          />
          <label htmlFor="confidentiality-perpetual">In perpetuity</label>
        </div>
      </Fieldset>

      <Fieldset legend="Governing law & jurisdiction">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Governing law" hint="State">
            <input
              className={inputClass}
              placeholder="e.g. Delaware"
              value={values.governingLaw}
              onChange={(e) => set("governingLaw", e.target.value)}
            />
          </Field>
          <Field label="Jurisdiction" hint="City or county and state">
            <input
              className={inputClass}
              placeholder="e.g. courts located in New Castle, DE"
              value={values.jurisdiction}
              onChange={(e) => set("jurisdiction", e.target.value)}
            />
          </Field>
        </div>
      </Fieldset>

      <Fieldset legend="Modifications">
        <Field label="MNDA modifications" hint="Optional changes to the Standard Terms">
          <textarea
            rows={3}
            className={inputClass}
            value={values.modifications}
            onChange={(e) => set("modifications", e.target.value)}
          />
        </Field>
      </Fieldset>

      {partyFields("party1", "Party 1")}
      {partyFields("party2", "Party 2")}
    </form>
  );
}
