import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Trash2 } from "lucide-react";
import type { EditorAction, EditorState } from "./editor-types";
import { getDefForType } from "./editor-types";

export function BottomPanel({
  state,
  dispatch,
}: {
  state: EditorState;
  dispatch: React.Dispatch<EditorAction>;
}) {
  return (
    <Tabs defaultValue="components" className="flex h-full flex-col">
      <TabsList className="h-9 w-fit rounded-none border-b border-slate-200 bg-white px-2">
        <TabsTrigger value="components" className="text-[11px]">
          QComponents
        </TabsTrigger>
        <TabsTrigger value="pins" className="text-[11px]">
          Pins
        </TabsTrigger>
        <TabsTrigger value="netlist" className="text-[11px]">
          Net List
        </TabsTrigger>
        <TabsTrigger value="variables" className="text-[11px]">
          Variables
        </TabsTrigger>
      </TabsList>

      <TabsContent value="components" className="m-0 flex-1 overflow-auto p-3">
        <Table headers={["Name", "Type", "pos_x", "pos_y", "Orientation"]}>
          {state.components.map((c) => (
            <tr
              key={c.id}
              className={c.id === state.selectedId ? "bg-indigo-50" : ""}
              onClick={() => dispatch({ type: "SELECT", id: c.id })}
            >
              <Td>{c.name}</Td>
              <Td>{c.type}</Td>
              <Td>{c.x.toFixed(3)}</Td>
              <Td>{c.y.toFixed(3)}</Td>
              <Td>{c.orientation}°</Td>
            </tr>
          ))}
        </Table>
      </TabsContent>

      <TabsContent value="pins" className="m-0 flex-1 overflow-auto p-3">
        <Table headers={["Component", "Pin", "Direction", "Connected To"]}>
          {state.components.flatMap((c) => {
            const def = getDefForType(c.type);
            return def.pins.map((p) => {
              const conn = state.connections.find(
                (cn) =>
                  (cn.fromComp === c.id && cn.fromPin === p) ||
                  (cn.toComp === c.id && cn.toPin === p),
              );
              const other = conn
                ? conn.fromComp === c.id
                  ? `${nameOf(state, conn.toComp)}.${conn.toPin}`
                  : `${nameOf(state, conn.fromComp)}.${conn.fromPin}`
                : "—";
              return (
                <tr key={`${c.id}-${p}`}>
                  <Td>{c.name}</Td>
                  <Td>{p}</Td>
                  <Td>{conn ? (conn.fromComp === c.id ? "out" : "in") : "—"}</Td>
                  <Td>{other}</Td>
                </tr>
              );
            });
          })}
        </Table>
      </TabsContent>

      <TabsContent value="netlist" className="m-0 flex-1 overflow-auto p-3">
        <Table headers={["ID", "From", "From Pin", "To", "To Pin", ""]}>
          {state.connections.map((c) => (
            <tr key={c.id}>
              <Td>{c.id.slice(0, 14)}…</Td>
              <Td>{nameOf(state, c.fromComp)}</Td>
              <Td>{c.fromPin}</Td>
              <Td>{nameOf(state, c.toComp)}</Td>
              <Td>{c.toPin}</Td>
              <Td>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 text-rose-500"
                  onClick={() => dispatch({ type: "DELETE_CONNECTION", id: c.id })}
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
              </Td>
            </tr>
          ))}
        </Table>
      </TabsContent>

      <TabsContent value="variables" className="m-0 flex-1 overflow-auto p-3">
        <div className="grid max-w-xl grid-cols-2 gap-3">
          <VarField
            label="frequency_range"
            value={state.variables.frequency_range}
            onChange={(v) => dispatch({ type: "UPDATE_VARIABLES", patch: { frequency_range: v } })}
          />
          <VarField
            label="qubit_gap (mm)"
            type="number"
            value={state.variables.qubit_gap}
            onChange={(v) =>
              dispatch({ type: "UPDATE_VARIABLES", patch: { qubit_gap: parseFloat(v) || 0 } })
            }
          />
          <VarField
            label="coupling_strength"
            type="number"
            value={state.variables.coupling_strength}
            onChange={(v) =>
              dispatch({
                type: "UPDATE_VARIABLES",
                patch: { coupling_strength: parseFloat(v) || 0 },
              })
            }
          />
          <VarField
            label="chip_size (mm)"
            type="number"
            value={state.variables.chip_size}
            onChange={(v) =>
              dispatch({ type: "UPDATE_VARIABLES", patch: { chip_size: parseFloat(v) || 0 } })
            }
          />
        </div>
      </TabsContent>
    </Tabs>
  );
}

function nameOf(state: EditorState, id: string) {
  return state.components.find((c) => c.id === id)?.name ?? id;
}

function Table({ headers, children }: { headers: string[]; children: React.ReactNode }) {
  return (
    <table className="w-full text-[11px]">
      <thead>
        <tr className="text-left text-[10px] font-bold uppercase tracking-wide text-slate-400">
          {headers.map((h) => (
            <th key={h} className="px-2 py-1.5 border-b border-slate-100">
              {h}
            </th>
          ))}
        </tr>
      </thead>
      <tbody className="text-slate-700 [&_tr]:cursor-pointer [&_tr:hover]:bg-slate-50">
        {children}
      </tbody>
    </table>
  );
}

function Td({ children }: { children: React.ReactNode }) {
  return <td className="px-2 py-1.5 border-b border-slate-50">{children}</td>;
}

function VarField({
  label,
  value,
  onChange,
  type = "text",
}: {
  label: string;
  value: string | number;
  onChange: (v: string) => void;
  type?: string;
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[10px] font-bold uppercase tracking-wide text-slate-400">{label}</span>
      <Input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-7 text-[11px]"
      />
    </label>
  );
}
