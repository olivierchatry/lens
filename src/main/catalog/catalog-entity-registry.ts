/**
 * Copyright (c) 2021 OpenLens Authors
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy of
 * this software and associated documentation files (the "Software"), to deal in
 * the Software without restriction, including without limitation the rights to
 * use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of
 * the Software, and to permit persons to whom the Software is furnished to do so,
 * subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS
 * FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR
 * COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER
 * IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN
 * CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
 */

import { once } from "lodash";
import { action, computed, IComputedValue, IObservableArray, makeObservable, observable } from "mobx";
import { CatalogCategoryRegistry, catalogCategoryRegistry, CatalogEntity, CatalogEntityKindData } from "../../common/catalog";
import { Disposer, iter } from "../../common/utils";

export type EntityFilter = (entity: CatalogEntity) => any;

export class CatalogEntityRegistry {
  protected sources = observable.map<string, IComputedValue<CatalogEntity[]>>();
  protected filters = observable.set<EntityFilter>([
    entity => this.categoryRegistry.getCategoryForEntity(entity)
  ], {
    deep: false,
  });

  constructor(private categoryRegistry: CatalogCategoryRegistry) {
    makeObservable(this);
  }

  @action addObservableSource(id: string, source: IObservableArray<CatalogEntity>) {
    this.sources.set(id, computed(() => source));
  }

  @action addComputedSource(id: string, source: IComputedValue<CatalogEntity[]>) {
    this.sources.set(id, source);
  }

  @action removeSource(id: string) {
    this.sources.delete(id);
  }

  @computed get items(): CatalogEntity[] {
    return Array.from(
      iter.reduce(
        this.filters,
        iter.filter,
        iter.flatMap(this.sources.values(), source => source.get()),
      )
    );
  }

  getById<T extends CatalogEntity>(id: string): T | undefined {
    const item = this.items.find((entity) => entity.metadata.uid === id);

    if (item) return item as T;

    return undefined;
  }

  getItemsForApiKind<T extends CatalogEntity>(apiVersion: string, kind: string): T[] {
    const items = this.items.filter((item) => item.apiVersion === apiVersion && item.kind === kind);

    return items as T[];
  }

  getItemsByEntityClass<T extends CatalogEntity>({ apiVersion, kind }: CatalogEntityKindData): T[] {
    return this.getItemsForApiKind(apiVersion, kind);
  }

  /**
   * Add a new filter to the set of item filters
   * @param fn The function that should return a truthy value if that entity should be sent currently "active"
   * @returns A function to remove that filter
   */
  addCatalogFilter(fn: EntityFilter): Disposer {
    this.filters.add(fn);

    return once(() => void this.filters.delete(fn));
  }
}

export const catalogEntityRegistry = new CatalogEntityRegistry(catalogCategoryRegistry);
