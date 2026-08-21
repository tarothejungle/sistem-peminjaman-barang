import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../../../lib/api";
import type { ApiResponse, Item } from "../../../types";

export const itemQueryKeys = {
  all: ["items"] as const,
};

export function useItems(enabled = true) {
  return useQuery({
    queryKey: itemQueryKeys.all,
    queryFn: async (): Promise<Item[]> => {
      const response = await api.get<ApiResponse<Item[]>>("/items");
      return response.data.data;
    },
    enabled,
  });
}

export interface ItemInput {
  name: string;
  category: string;
  totalStock: number;
  image?: File;
}

function itemFormData(input: ItemInput): FormData {
  const data = new FormData();
  data.append("name", input.name);
  data.append("category", input.category);
  data.append("totalStock", String(input.totalStock));
  if (input.image) data.append("image", input.image);
  return data;
}

export function useCreateItem() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: ItemInput): Promise<Item> => {
      const response = await api.post<ApiResponse<Item>>("/items", itemFormData(input));
      return response.data.data;
    },
    onSuccess: async () => queryClient.invalidateQueries({ queryKey: itemQueryKeys.all }),
  });
}

export function useUpdateItem() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ itemId, ...input }: ItemInput & { itemId: string }): Promise<Item> => {
      const response = await api.post<ApiResponse<Item>>(`/items/${itemId}`, itemFormData(input));
      return response.data.data;
    },
    onSuccess: async () => queryClient.invalidateQueries({ queryKey: itemQueryKeys.all }),
  });
}
