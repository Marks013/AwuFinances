"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { CurrencyInput } from "@/components/ui/currency-input";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PresetChip } from "@/components/ui/preset-chip";
import { Select } from "@/components/ui/select";
import type { CategoryFormValues } from "@/features/categories/schemas/category-schema";
import { categoryFormResolver } from "@/lib/client-form-resolvers";
import { categoryColorPresets, findPreset } from "@/lib/finance/presets";
import { ensureApiResponse } from "@/lib/observability/http";

type CategoryItem = {
  id: string;
  name: string;
  icon: string;
  color: string;
  type: "income" | "expense";
  isDefault: boolean;
  monthlyLimit: number | null;
  keywords: string[];
};

async function getCategories() {
  const response = await fetch("/api/categories", { cache: "no-store" });
  await ensureApiResponse(response, { fallbackMessage: "Falha ao carregar categorias", method: "GET", path: "/api/categories" });
  return (await response.json()) as { items: CategoryItem[] };
}

async function createCategory(values: CategoryFormValues) {
  const response = await fetch("/api/categories", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(values)
  });

  await ensureApiResponse(response, { fallbackMessage: "Falha ao criar categoria", method: "POST", path: "/api/categories" });
  return response.json();
}

async function updateCategory(id: string, values: CategoryFormValues) {
  const response = await fetch(`/api/categories/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(values)
  });

  await ensureApiResponse(response, { fallbackMessage: "Falha ao atualizar categoria", method: "PATCH", path: `/api/categories/${id}` });
  return response.json();
}

async function deleteCategory(id: string) {
  const response = await fetch(`/api/categories/${id}`, { method: "DELETE" });
  await ensureApiResponse(response, { fallbackMessage: "Falha ao excluir categoria", method: "DELETE", path: `/api/categories/${id}` });
}

async function restoreDefaultCategories() {
  const response = await fetch("/api/categories/defaults", { method: "POST" });
  await ensureApiResponse(response, {
    fallbackMessage: "Falha ao restaurar categorias padrao",
    method: "POST",
    path: "/api/categories/defaults"
  });

  if (!response.ok) {
    const payload = (await response.json()) as { message?: string };
    throw new Error(payload.message ?? "Falha ao restaurar categorias padrao");
  }

  return (await response.json()) as { restored: number; total: number };
}

function formatMoney(value: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
}

export function CategoriesClient() {
  const queryClient = useQueryClient();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const formSectionRef = useRef<HTMLElement | null>(null);
  const categoriesQuery = useQuery({ queryKey: ["categories"], queryFn: getCategories });
  const categories = categoriesQuery.data?.items ?? [];
  const expenseCategories = categories.filter((category) => category.type === "expense").length;
  const incomeCategories = categories.filter((category) => category.type === "income").length;
  const form = useForm<CategoryFormValues>({
    resolver: categoryFormResolver,
    defaultValues: {
      name: "",
      icon: "tag",
      color: categoryColorPresets[0].value,
      type: "expense",
      monthlyLimit: null,
      keywords: ""
    }
  });

  const saveMutation = useMutation({
    mutationFn: async (values: CategoryFormValues) => (editingId ? updateCategory(editingId, values) : createCategory(values)),
    onSuccess: async () => {
      const wasEditing = Boolean(editingId);
      toast.success(editingId ? "Categoria atualizada" : "Categoria criada");
      setEditingId(null);
      if (wasEditing) setIsEditorOpen(false);
      form.reset();
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["categories"] }),
        queryClient.invalidateQueries({ queryKey: ["transactions"] }),
        queryClient.invalidateQueries({ queryKey: ["reports-summary"] })
      ]);
    },
    onError: (error) => {
      toast.error(editingId ? "Nao foi possivel atualizar a categoria" : "Nao foi possivel criar a categoria", {
        description: error.message
      });
    }
  });

  const deleteMutation = useMutation({
    mutationFn: deleteCategory,
    onSuccess: async () => {
      toast.success("Categoria excluida");
      if (editingId) {
        setEditingId(null);
        setIsEditorOpen(false);
        form.reset();
      }
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["categories"] }),
        queryClient.invalidateQueries({ queryKey: ["transactions"] }),
        queryClient.invalidateQueries({ queryKey: ["reports-summary"] })
      ]);
    },
    onError: (error) => {
      toast.error("Nao foi possivel excluir a categoria", { description: error.message });
    }
  });

  const restoreDefaultsMutation = useMutation({
    mutationFn: restoreDefaultCategories,
    onSuccess: async (payload) => {
      toast.success("Categorias padrao restauradas", {
        description:
          payload.restored > 0
            ? `${payload.restored} categoria(s) adicionada(s) sem duplicar as existentes.`
            : "Nenhuma categoria nova foi adicionada porque a base ja estava completa."
      });
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["categories"] }),
        queryClient.invalidateQueries({ queryKey: ["transactions"] }),
        queryClient.invalidateQueries({ queryKey: ["reports-summary"] })
      ]);
    },
    onError: (error) => {
      toast.error("Nao foi possivel restaurar as categorias padrao", { description: error.message });
    }
  });

  const startEditing = (category: CategoryItem) => {
    setIsEditorOpen(true);
    setEditingId(category.id);
    form.reset({
      name: category.name,
      icon: category.icon,
      color: category.color,
      type: category.type,
      monthlyLimit: category.monthlyLimit,
      keywords: category.keywords.join(", ")
    });
  };

  const cancelEditing = () => {
    setEditingId(null);
    setIsEditorOpen(false);
    form.reset();
  };

  const openCreateForm = () => {
    setEditingId(null);
    setIsEditorOpen(true);
    form.reset();
  };

  const isEditing = editingId !== null;
  const showEditor = isEditorOpen || isEditing || categories.length === 0;
  const selectedColor = useWatch({ control: form.control, name: "color" }) ?? categoryColorPresets[0].value;
  const selectedType = useWatch({ control: form.control, name: "type" }) ?? "expense";

  useEffect(() => {
    if (!editingId) return;

    const timeout = window.setTimeout(() => {
      const target = document.getElementById("category-name");
      const scrollTarget = target ?? formSectionRef.current;

      scrollTarget?.scrollIntoView({ behavior: "smooth", block: "center" });
      target?.focus({ preventScroll: true });
    }, 80);

    return () => window.clearTimeout(timeout);
  }, [editingId]);

  return (
    <div className="grid items-start gap-6 xl:grid-cols-[minmax(320px,0.72fr)_minmax(0,1.28fr)]">
      <section className="surface content-section self-start" ref={formSectionRef}>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            <div className="eyebrow">Categorias</div>
            <h1 className="mt-3 text-balance text-2xl font-semibold leading-tight md:text-3xl">
              {isEditing ? "Editar categoria" : "Nova categoria"}
            </h1>
          </div>
          {!showEditor ? (
            <Button onClick={openCreateForm} type="button" variant="secondary">
              Nova categoria
            </Button>
          ) : null}
        </div>
        <p className="mt-3 max-w-2xl text-pretty text-sm leading-6 text-[var(--color-muted-foreground)]">
          Cadastre categorias claras para organizar lancamentos e melhorar os relatorios.
        </p>

        {showEditor ? (
          <form className="mt-6 space-y-4" onSubmit={form.handleSubmit((values) => saveMutation.mutate(values))}>
            <div className="space-y-2">
              <Label htmlFor="category-name">Nome</Label>
              <Input id="category-name" {...form.register("name")} />
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="category-type">Tipo</Label>
                <Select id="category-type" {...form.register("type")}>
                  <option value="expense">Despesa</option>
                  <option value="income">Receita</option>
                </Select>
              </div>
              <div className="space-y-3">
                <Label>Cor</Label>
                <div className="flex flex-wrap gap-2">
                  {categoryColorPresets.map((preset) => (
                    <button
                      aria-label={`Selecionar cor ${preset.label}`}
                      key={preset.value}
                      className="rounded-full"
                      onClick={() => form.setValue("color", preset.value, { shouldDirty: true })}
                      type="button"
                    >
                      <PresetChip active={selectedColor === preset.value} background={preset.background} color={preset.color} label={preset.label} shortLabel={preset.shortLabel} swatchOnly />
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="category-icon">Icone</Label>
                <Input id="category-icon" {...form.register("icon")} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="category-monthly-limit">Limite mensal</Label>
                <CurrencyInput control={form.control} id="category-monthly-limit" name="monthlyLimit" nullable placeholder="Opcional" />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="category-keywords">Palavras-chave</Label>
              <Input id="category-keywords" placeholder="mercado, casa, salario" {...form.register("keywords")} />
            </div>
            <div className="muted-panel flex flex-wrap items-center gap-3 p-4">
              <PresetChip active background={findPreset(categoryColorPresets, selectedColor)?.background ?? "rgba(107,114,128,0.14)"} color={findPreset(categoryColorPresets, selectedColor)?.color ?? selectedColor} label={selectedType === "income" ? "Categoria de receita" : "Categoria de despesa"} shortLabel="" swatchOnly />
              <p className="text-sm text-[var(--color-muted-foreground)]">A cor aparece na interface e nos graficos.</p>
            </div>
            <Button className="w-full" disabled={saveMutation.isPending} type="submit">
              {saveMutation.isPending ? "Salvando..." : isEditing ? "Salvar categoria" : "Criar categoria"}
            </Button>
            {isEditing ? (
              <Button className="w-full" onClick={cancelEditing} type="button" variant="ghost">
                Cancelar edicao
              </Button>
            ) : null}
          </form>
        ) : (
          <div className="muted-panel mt-6 flex flex-col gap-4 p-4 text-sm text-[var(--color-muted-foreground)]">
            <p>Editor fechado. Abra apenas quando precisar criar ou editar.</p>
            <Button className="w-full sm:w-auto" onClick={openCreateForm} type="button" variant="secondary">
              Nova categoria
            </Button>
          </div>
        )}
      </section>

      <section className="surface content-section">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            <h2 className="text-balance text-2xl font-semibold leading-tight">Categorias ativas</h2>
            <p className="mt-2 text-pretty text-sm leading-6 text-[var(--color-muted-foreground)]">
              Lista compacta com detalhes expansíveis para evitar cards repetidos.
            </p>
          </div>
          <div className="flex w-full flex-col gap-3 sm:w-auto sm:items-end">
            <Button className="w-full sm:w-auto" disabled={restoreDefaultsMutation.isPending} onClick={() => restoreDefaultsMutation.mutate()} type="button" variant="secondary">
              {restoreDefaultsMutation.isPending ? "Restaurando..." : "Restaurar padrão"}
            </Button>
            <div className="flex w-full flex-wrap gap-2 sm:justify-end">
              <span className="inline-flex items-center gap-2 rounded-full border border-[var(--color-border)] bg-[var(--color-muted)]/24 px-3 py-2 text-xs font-semibold text-[var(--color-muted-foreground)]">
                Despesas
                <strong className="tabular-nums text-sm text-[var(--color-foreground)]">{expenseCategories}</strong>
              </span>
              <span className="inline-flex items-center gap-2 rounded-full border border-[var(--color-border)] bg-[var(--color-muted)]/24 px-3 py-2 text-xs font-semibold text-[var(--color-muted-foreground)]">
                Receitas
                <strong className="tabular-nums text-sm text-[var(--color-foreground)]">{incomeCategories}</strong>
              </span>
            </div>
          </div>
        </div>

        <div className="mt-5 max-h-[min(72dvh,760px)] divide-y divide-[var(--color-border)] overflow-y-auto rounded-[1.25rem] border border-[var(--color-border)] bg-[var(--color-card)]">
          {categories.map((category) => (
            <details key={category.id} className="group">
              <summary className="flex cursor-pointer list-none items-center gap-3 px-4 py-3 [&::-webkit-details-marker]:hidden">
                <span className="inline-flex shrink-0 rounded-full">
                  <PresetChip compact active background={findPreset(categoryColorPresets, category.color)?.background ?? "rgba(107,114,128,0.14)"} color={findPreset(categoryColorPresets, category.color)?.color ?? category.color} label={category.name} shortLabel="" swatchOnly />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold text-[var(--color-foreground)]">{category.name}</span>
                  <span className="mt-1 flex flex-wrap gap-2 text-xs text-[var(--color-muted-foreground)]">
                    <span>{category.type === "income" ? "Receita" : "Despesa"}</span>
                    <span aria-hidden="true">•</span>
                    <span>{category.isDefault ? "Padrao" : "Personalizada"}</span>
                    {category.monthlyLimit ? (
                      <>
                        <span aria-hidden="true">•</span>
                        <span className="tabular-nums">{formatMoney(category.monthlyLimit)}</span>
                      </>
                    ) : null}
                  </span>
                </span>
                <span className="text-xs font-semibold text-[var(--color-muted-foreground)]">detalhes</span>
              </summary>
              <div className="space-y-3 px-4 pb-4 pl-14">
                {category.keywords.length > 0 ? (
                  <p className="break-words text-sm leading-6 text-[var(--color-muted-foreground)]">
                    Palavras-chave: {category.keywords.join(", ")}
                  </p>
                ) : (
                  <p className="text-sm leading-6 text-[var(--color-muted-foreground)]">Sem palavras-chave cadastradas.</p>
                )}
                <div className="flex flex-wrap gap-2">
                  <Button onClick={() => startEditing(category)} type="button" variant="secondary">
                    Editar
                  </Button>
                  <Button disabled={deleteMutation.isPending} onClick={() => deleteMutation.mutate(category.id)} type="button" variant="ghost">
                    Excluir
                  </Button>
                </div>
              </div>
            </details>
          ))}
          {!categoriesQuery.isLoading && categories.length === 0 ? (
            <div className="px-4 py-6 text-sm text-[var(--color-muted-foreground)]">
              Nenhuma categoria cadastrada ainda.
            </div>
          ) : null}
        </div>
      </section>
    </div>
  );
}
