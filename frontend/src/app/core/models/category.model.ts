export interface Category {
  id: number;
  name: string;
  icon_filename: string | null;
  icon_url: string | null;
  approved: boolean;
  created_by: string;
  created_at: string | null;
  updated_at: string | null;
  archived_at: string | null;
}

export interface CreateCategoryRequest {
  name: string;
}

export interface UpdateCategoryRequest {
  name?: string;
  approved?: boolean;
  archived?: boolean;
}
