import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import type {
  Category,
  CreateCategoryRequest,
  UpdateCategoryRequest,
} from '../models/category.model';

@Injectable({
  providedIn: 'root',
})
export class CategoryService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = '/api/v1';

  listCategories(): Observable<Category[]> {
    return this.http.get<Category[]>(`${this.apiUrl}/categories`);
  }

  createCategory(name: string): Observable<Category> {
    const body: CreateCategoryRequest = { name };
    return this.http.post<Category>(`${this.apiUrl}/categories`, body);
  }

  updateCategory(id: number, data: UpdateCategoryRequest): Observable<Category> {
    return this.http.patch<Category>(`${this.apiUrl}/categories/${id}`, data);
  }

  uploadIcon(id: number, file: File): Observable<Category> {
    const formData = new FormData();
    formData.append('file', file);
    return this.http.post<Category>(`${this.apiUrl}/categories/${id}/icon`, formData);
  }

  deleteIcon(id: number): Observable<Category> {
    return this.http.delete<Category>(`${this.apiUrl}/categories/${id}/icon`);
  }
}
