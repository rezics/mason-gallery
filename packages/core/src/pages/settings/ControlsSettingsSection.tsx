import {
  formatForDisplay,
  normalizeRegisterableHotkey,
  useHotkeyRecorder,
} from "@tanstack/react-hotkeys";
import { useId, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog } from "@/components/ui/dialog";
import { FieldGroup } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { NativeSelect as Select } from "@/components/ui/native-select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { usePlatform } from "@/context/PlatformContext";
import { useI18n } from "@/i18n";
import {
  ACTIONS,
  type ActionId,
  bindingSchema,
  bindingsOverlap,
  findBindingConflicts,
  fromHotkey,
  type InputBinding,
  type Modifier,
  resolveBindings,
  toHotkey,
} from "@/input/bindings";
import { useInputSuspension } from "@/input/useActionInputs";
import { useSettingsStore } from "@/stores/settingsStore";
import { SettingsField, SettingsSection } from "./SettingsField";

function BindingEditor({
  id,
  initial,
  onClose,
}: {
  id: ActionId;
  initial: InputBinding[];
  onClose: () => void;
}) {
  const t = useI18n();
  const settings = useSettingsStore((state) => state.inputBindings);
  const setBindings = useSettingsStore((state) => state.setActionBindings);
  const [bindings, setBindingsDraft] = useState(initial);
  const { capabilities } = usePlatform();
  const editorId = useId();
  const nextRowId = useRef(initial.length);
  const [rowIds, setRowIds] = useState(() =>
    initial.map((_, index) => `${editorId}-${index}`),
  );
  const [recordIndex, setRecordIndex] = useState<number | null>(null);
  const [recordBy, setRecordBy] = useState<"key" | "code">("code");
  const [rejected, setRejected] = useState(false);
  const recordedLogicalKey = useRef<string | undefined>(undefined);
  useInputSuspension(true);
  const update = (index: number, binding: InputBinding) =>
    setBindingsDraft((current) =>
      current.map((item, i) => (i === index ? binding : item)),
    );
  const remove = (index: number) => {
    setBindingsDraft((current) => current.filter((_, i) => i !== index));
    setRowIds((current) => current.filter((_, i) => i !== index));
  };
  const recorder = useHotkeyRecorder({
    recordBy,
    ignoreInputs: false,
    validate: (_hotkey, { event }) => {
      recordedLogicalKey.current = event.key;
      return true;
    },
    onRecord: (hotkey) => {
      if (recordIndex !== null)
        update(recordIndex, {
          ...fromHotkey(hotkey, recordedLogicalKey.current),
          condition: bindings[recordIndex]?.condition,
        });
      setRecordIndex(null);
    },
    onCancel: () => setRecordIndex(null),
    onClear: () => {
      if (recordIndex !== null) remove(recordIndex);
      setRecordIndex(null);
    },
    onReject: () => setRejected(true),
  });
  const conflicts = findBindingConflicts(settings, id, bindings, capabilities);
  const validity = bindings.map(
    (binding) => bindingSchema.safeParse(binding).success,
  );
  const invalid = validity.includes(false);
  const selfConflict = bindings.some((binding, i) =>
    bindings.slice(i + 1).some((other) => bindingsOverlap(binding, other)),
  );
  const action = ACTIONS.find((action) => action.id === id);
  return (
    <Dialog
      open
      title={action ? t(action.labelKey) : id}
      onClose={onClose}
      className="max-h-[85vh] overflow-auto sm:max-w-xl"
      actions={
        <>
          <Button variant="outline" onClick={onClose}>
            {t("actions:close")}
          </Button>
          <Button
            disabled={
              invalid ||
              selfConflict ||
              conflicts.length > 0 ||
              recorder.isRecording
            }
            onClick={() => {
              setBindings(id, bindings);
              onClose();
            }}
          >
            {t("settings:saveBindings")}
          </Button>
        </>
      }
    >
      <FieldGroup>
        {bindings.map((binding, index) => (
          <SettingsField
            key={rowIds[index]}
            label={t("settings:bindingNumber", { number: index + 1 })}
            invalid={!validity[index]}
          >
            <div className="flex flex-col gap-3">
              <div className="flex flex-wrap items-center gap-2">
                <Select
                  aria-label={t("settings:inputDevice")}
                  value={binding.type}
                  disabled={recorder.isRecording}
                  onChange={(event) => {
                    const type = event.target.value;
                    update(
                      index,
                      type === "keyboard"
                        ? { type, key: "", match: recordBy, modifiers: [] }
                        : type === "mouse"
                          ? {
                              type,
                              button: "left",
                              click: "single",
                              modifiers: [],
                            }
                          : { type: "wheel", direction: "up", modifiers: [] },
                    );
                  }}
                >
                  <option value="keyboard">{t("settings:keyboard")}</option>
                  {action?.scope === "viewer" && (
                    <>
                      <option value="mouse">{t("settings:mouse")}</option>
                      <option value="wheel">{t("settings:wheel")}</option>
                    </>
                  )}
                </Select>
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={recorder.isRecording}
                  onClick={() => remove(index)}
                >
                  {t("settings:removeBinding")}
                </Button>
              </div>
              {binding.type === "keyboard" ? (
                <div className="flex flex-wrap gap-2">
                  <Select
                    aria-label={t("settings:keyMatching")}
                    value={binding.match}
                    disabled={recorder.isRecording}
                    onChange={(event) => {
                      const match = event.target.value as "key" | "code";
                      setRecordBy(match);
                      update(index, {
                        ...binding,
                        match,
                        key: "",
                        logicalKey: undefined,
                      });
                    }}
                  >
                    <option value="code">{t("settings:physicalKey")}</option>
                    <option value="key">{t("settings:logicalKey")}</option>
                  </Select>
                  <Input
                    className="w-32"
                    aria-label={t("settings:keyValue")}
                    aria-invalid={!validity[index]}
                    value={binding.key}
                    disabled={recorder.isRecording}
                    onChange={(event) =>
                      update(index, {
                        ...binding,
                        key: event.target.value,
                        logicalKey: undefined,
                      })
                    }
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={recorder.isRecording && recordIndex !== index}
                    onClick={() => {
                      if (recorder.isRecording) recorder.cancelRecording();
                      else {
                        setRecordBy(binding.match);
                        setRecordIndex(index);
                        setRejected(false);
                        recorder.startRecording();
                      }
                    }}
                  >
                    {recorder.isRecording && recordIndex === index
                      ? t("settings:cancelRecording")
                      : t("settings:recordKey")}
                  </Button>
                </div>
              ) : binding.type === "mouse" ? (
                <div className="flex flex-wrap gap-2">
                  <Select
                    aria-label={t("settings:mouseButton")}
                    disabled={recorder.isRecording}
                    value={binding.button}
                    onChange={(event) =>
                      update(index, {
                        ...binding,
                        button: event.target.value as
                          | "left"
                          | "middle"
                          | "right",
                      })
                    }
                  >
                    {["left", "middle", "right"].map((button) => (
                      <option key={button} value={button}>
                        {t(`settings:mouse_${button}`)}
                      </option>
                    ))}
                  </Select>
                  <Select
                    aria-label={t("settings:clickType")}
                    disabled={recorder.isRecording}
                    value={binding.click}
                    onChange={(event) =>
                      update(index, {
                        ...binding,
                        click: event.target.value as "single" | "double",
                      })
                    }
                  >
                    <option value="single">{t("settings:singleClick")}</option>
                    <option value="double">{t("settings:doubleClick")}</option>
                  </Select>
                </div>
              ) : (
                <Select
                  aria-label={t("settings:wheelDirection")}
                  disabled={recorder.isRecording}
                  value={binding.direction}
                  onChange={(event) =>
                    update(index, {
                      ...binding,
                      direction: event.target.value as "up" | "down",
                    })
                  }
                >
                  <option value="up">{t("settings:wheel_up")}</option>
                  <option value="down">{t("settings:wheel_down")}</option>
                </Select>
              )}
              <div className="flex flex-wrap gap-3">
                {(["Control", "Alt", "Shift", "Meta", "Mod"] as Modifier[])
                  .filter(
                    (modifier) =>
                      binding.type !== "wheel" ||
                      !["Control", "Mod"].includes(modifier),
                  )
                  .map((modifier) => (
                    <label
                      key={modifier}
                      htmlFor={`${rowIds[index]}-${modifier}`}
                      className="flex items-center gap-1.5 text-sm"
                    >
                      <Checkbox
                        id={`${rowIds[index]}-${modifier}`}
                        disabled={recorder.isRecording}
                        checked={binding.modifiers.includes(modifier)}
                        onCheckedChange={(checked) =>
                          update(index, {
                            ...binding,
                            modifiers: checked
                              ? [...binding.modifiers, modifier]
                              : binding.modifiers.filter(
                                  (item) => item !== modifier,
                                ),
                          })
                        }
                      />
                      {modifier}
                    </label>
                  ))}
              </div>
              {action?.scope === "viewer" && (
                <Select
                  aria-label={t("settings:zoomCondition")}
                  value={binding.condition ?? "always"}
                  disabled={recorder.isRecording}
                  onChange={(event) =>
                    update(index, {
                      ...binding,
                      condition:
                        event.target.value === "always"
                          ? undefined
                          : (event.target.value as "zoomed" | "unzoomed"),
                    })
                  }
                >
                  <option value="always">
                    {t("settings:condition_always")}
                  </option>
                  <option value="zoomed">
                    {t("settings:condition_zoomed")}
                  </option>
                  <option value="unzoomed">
                    {t("settings:condition_unzoomed")}
                  </option>
                </Select>
              )}
            </div>
          </SettingsField>
        ))}
      </FieldGroup>
      <Button
        variant="outline"
        disabled={recorder.isRecording || bindings.length >= 16}
        onClick={() => {
          const rowId = `${editorId}-${nextRowId.current++}`;
          setRowIds((current) => [...current, rowId]);
          setBindingsDraft((current) => [
            ...current,
            { type: "keyboard", key: "", match: recordBy, modifiers: [] },
          ]);
        }}
      >
        {t("settings:addBinding")}
      </Button>
      {recorder.isRecording && (
        <p role="status">{t("settings:recordingHint")}</p>
      )}
      {rejected && <p role="alert">{t("settings:recordingRejected")}</p>}
      {invalid && (
        <p className="text-destructive" role="alert">
          {t("settings:invalidBinding")}
        </p>
      )}
      {(selfConflict || conflicts.length > 0) && (
        <p className="text-destructive" role="alert">
          {t("settings:bindingConflict", {
            actions:
              conflicts
                .map((conflict) =>
                  t(
                    ACTIONS.find((action) => action.id === conflict)
                      ?.labelKey ?? conflict,
                  ),
                )
                .join(", ") || t("settings:duplicateBinding"),
          })}
        </p>
      )}
      <p className="text-sm text-muted-foreground">
        {t("settings:clickBindingHint")}
      </p>
    </Dialog>
  );
}

export function ControlsSettingsSection() {
  const t = useI18n();
  const platform = usePlatform();
  const settings = useSettingsStore((state) => state.inputBindings);
  const setSettings = useSettingsStore((state) => state.setInputBindings);
  const setBindings = useSettingsStore((state) => state.setActionBindings);
  const [editing, setEditing] = useState<ActionId | null>(null);
  const describe = (binding: InputBinding) => {
    const modifiers = binding.modifiers.join("+");
    const base =
      binding.type === "keyboard"
        ? formatForDisplay(normalizeRegisterableHotkey(toHotkey(binding)))
        : [
            modifiers,
            binding.type === "wheel"
              ? t(`settings:wheel_${binding.direction}`)
              : `${t(`settings:mouse_${binding.button}`)} · ${t(`settings:${binding.click}Click`)}`,
          ]
            .filter(Boolean)
            .join("+");
    return binding.condition
      ? `${base} (${t(`settings:condition_${binding.condition}`)})`
      : base;
  };
  return (
    <SettingsSection>
      <SettingsField
        id="input-preset"
        label={t("settings:inputPreset")}
        hint={t("settings:inputPresetHint")}
      >
        <Select
          value={settings.preset}
          onChange={(event) =>
            setSettings({
              ...settings,
              preset: event.target.value as typeof settings.preset,
            })
          }
        >
          <option value="current">{t("settings:preset_current")}</option>
          <option value="wheel-navigation">
            {t("settings:preset_wheel-navigation")}
          </option>
        </Select>
      </SettingsField>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{t("settings:action")}</TableHead>
            <TableHead>{t("settings:keyboard")}</TableHead>
            <TableHead>{t("settings:mouseWheel")}</TableHead>
            <TableHead>{t("settings:bindingActions")}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {ACTIONS.filter(
            (action) =>
              !action.capability || platform.capabilities[action.capability],
          ).map((action) => {
            const bindings = resolveBindings(settings, action.id);
            const conflicts = findBindingConflicts(
              settings,
              action.id,
              bindings,
              platform.capabilities,
            );
            return (
              <TableRow key={action.id} id={action.id.replace(".", "-")}>
                <TableCell>
                  <div className="font-medium">{t(action.labelKey)}</div>
                  <div className="text-xs text-muted-foreground">
                    {t(`settings:scope_${action.scope}`)}
                  </div>
                  {conflicts.length > 0 && (
                    <span className="text-destructive">
                      {t("settings:conflict")}
                    </span>
                  )}
                </TableCell>
                {[true, false].map((keyboard) => (
                  <TableCell key={String(keyboard)}>
                    <div className="flex flex-col gap-1">
                      {bindings
                        .filter(
                          (binding) =>
                            (binding.type === "keyboard") === keyboard,
                        )
                        .map((binding) => (
                          <span key={JSON.stringify(binding)}>
                            {describe(binding)}
                          </span>
                        ))}
                    </div>
                  </TableCell>
                ))}
                <TableCell>
                  <div className="flex gap-1">
                    <Button
                      size="sm"
                      variant="outline"
                      aria-label={`${t(action.labelKey)}: ${t("settings:editBindings")}`}
                      onClick={() => setEditing(action.id)}
                    >
                      {t("settings:editBindings")}
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setBindings(action.id, undefined)}
                    >
                      {t("settings:restoreBinding")}
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
      <Button
        variant="outline"
        onClick={() => setSettings({ preset: "current", overrides: {} })}
      >
        {t("settings:restoreAllBindings")}
      </Button>
      {editing && (
        <BindingEditor
          id={editing}
          initial={resolveBindings(settings, editing)}
          onClose={() => setEditing(null)}
        />
      )}
    </SettingsSection>
  );
}
