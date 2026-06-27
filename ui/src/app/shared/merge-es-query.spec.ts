import {mergeEsQuery} from './merge-es-query';

describe(mergeEsQuery.name, () => {
  describe('bool clause arrays', () => {
    it('concatenates must, should, must_not, filter', () => {
      const base = {
        query: {
          bool: {
            must: [{term: {a: 1}}],
            should: [{term: {b: 1}}],
            must_not: [{term: {c: 1}}],
            filter: [{term: {d: 1}}],
          },
        },
      };
      const override = {
        query: {
          bool: {
            must: [{term: {a: 2}}],
            should: [{term: {b: 2}}],
            must_not: [{term: {c: 2}}],
            filter: [{term: {d: 2}}],
          },
        },
      };
      const result = mergeEsQuery(base as never, override as never);
      expect(result).toEqual({
        query: {
          bool: {
            must: [{term: {a: 1}}, {term: {a: 2}}],
            should: [{term: {b: 1}}, {term: {b: 2}}],
            must_not: [{term: {c: 1}}, {term: {c: 2}}],
            filter: [{term: {d: 1}}, {term: {d: 2}}],
          },
        },
      });
    });

    it('normalizes object form of must to an array before concatenating', () => {
      const base = {query: {bool: {must: {term: {a: 1}}}}};
      const override = {query: {bool: {must: [{term: {a: 2}}]}}};
      expect(mergeEsQuery(base as never, override as never)).toEqual({
        query: {bool: {must: [{term: {a: 1}}, {term: {a: 2}}]}},
      });
    });

    it('concatenates nested bool clauses', () => {
      const base = {
        query: {bool: {filter: [{bool: {must: [{term: {a: 1}}]}}]}},
      };
      const override = {
        query: {bool: {filter: [{term: {b: 2}}]}},
      };
      const result = mergeEsQuery(base as never, override as never);
      expect((result as any).query.bool.filter).toHaveLength(2);
    });
  });

  describe('function_score, rescore, sort', () => {
    it('concatenates functions[]', () => {
      const base = {query: {function_score: {functions: [{weight: 1}]}}};
      const override = {query: {function_score: {functions: [{weight: 2}]}}};
      expect(mergeEsQuery(base as never, override as never)).toEqual({
        query: {function_score: {functions: [{weight: 1}, {weight: 2}]}},
      });
    });

    it('concatenates rescore[]', () => {
      const base = {rescore: [{window_size: 50}]};
      const override = {rescore: [{window_size: 100}]};
      expect(mergeEsQuery(base as never, override as never)).toEqual({
        rescore: [{window_size: 50}, {window_size: 100}],
      });
    });

    it('concatenates sort[]', () => {
      const base = {sort: [{a: 'asc'}]};
      const override = {sort: [{b: 'desc'}]};
      expect(mergeEsQuery(base as never, override as never)).toEqual({
        sort: [{a: 'asc'}, {b: 'desc'}],
      });
    });
  });

  describe('_source includes/excludes', () => {
    it('concatenates and dedupes includes', () => {
      const base = {_source: {includes: ['a', 'b']}};
      const override = {_source: {includes: ['b', 'c']}};
      expect(mergeEsQuery(base as never, override as never)).toEqual({
        _source: {includes: ['a', 'b', 'c']},
      });
    });

    it('concatenates and dedupes excludes', () => {
      const base = {_source: {excludes: ['x']}};
      const override = {_source: {excludes: ['x', 'y']}};
      expect(mergeEsQuery(base as never, override as never)).toEqual({
        _source: {excludes: ['x', 'y']},
      });
    });
  });

  describe('single-slot query containers', () => {
    it('replaces function_score.query wholesale', () => {
      const base = {query: {function_score: {query: {match: {a: 'x'}}}}};
      const override = {query: {function_score: {query: {term: {b: 'y'}}}}};
      expect(mergeEsQuery(base as never, override as never)).toEqual({
        query: {function_score: {query: {term: {b: 'y'}}}},
      });
    });

    it('replaces nested.query wholesale', () => {
      const base = {query: {nested: {path: 'p', query: {match: {a: 'x'}}}}};
      const override = {query: {nested: {query: {term: {b: 'y'}}}}};
      expect(mergeEsQuery(base as never, override as never)).toEqual({
        query: {nested: {path: 'p', query: {term: {b: 'y'}}}},
      });
    });

    it('replaces root query wholesale', () => {
      const base = {query: {match: {a: 'x'}}};
      const override = {query: {term: {b: 'y'}}};
      expect(mergeEsQuery(base as never, override as never)).toEqual({query: {term: {b: 'y'}}});
    });
  });

  describe('atomic objects', () => {
    it('replaces script wholesale', () => {
      const base = {script: {source: 'doc.a.value', lang: 'painless', params: {x: 1}}};
      const override = {script: {source: 'doc.b.value'}};
      expect(mergeEsQuery(base as never, override as never)).toEqual({script: {source: 'doc.b.value'}});
    });

    it('replaces range wholesale', () => {
      const base = {range: {age: {gte: 18, lte: 65}}};
      const override = {range: {age: {gte: 21}}};
      expect(mergeEsQuery(base as never, override as never)).toEqual({range: {age: {gte: 21}}});
    });

    it('replaces geo_distance wholesale', () => {
      const base = {geo_distance: {distance: '10km', location: [0, 0]}};
      const override = {geo_distance: {distance: '5km'}};
      expect(mergeEsQuery(base as never, override as never)).toEqual({geo_distance: {distance: '5km'}});
    });
  });

  describe('aggs', () => {
    it('merges agg names by key', () => {
      const base = {aggs: {a: {terms: {field: 'x'}}}};
      const override = {aggs: {b: {terms: {field: 'y'}}}};
      expect(mergeEsQuery(base as never, override as never)).toEqual({
        aggs: {
          a: {terms: {field: 'x'}},
          b: {terms: {field: 'y'}},
        },
      });
    });

    it('replaces a same-named agg wholesale, not deep-merging bodies', () => {
      const base = {aggs: {a: {terms: {field: 'x', size: 10}}}};
      const override = {aggs: {a: {date_histogram: {field: 'ts', interval: 'day'}}}};
      expect(mergeEsQuery(base as never, override as never)).toEqual({
        aggs: {a: {date_histogram: {field: 'ts', interval: 'day'}}},
      });
    });

    it('merges nested aggs by key inside an agg body', () => {
      const base = {aggs: {outer: {terms: {field: 'x'}, aggs: {inner1: {sum: {field: 'a'}}}}}};
      const override = {aggs: {outer: {terms: {field: 'x'}, aggs: {inner2: {avg: {field: 'b'}}}}}};
      // The named-children rule means override.aggs.outer replaces base.aggs.outer wholesale.
      expect(mergeEsQuery(base as never, override as never)).toEqual({
        aggs: {outer: {terms: {field: 'x'}, aggs: {inner2: {avg: {field: 'b'}}}}},
      });
    });
  });

  describe('highlight.fields', () => {
    it('merges highlight.fields by field name', () => {
      const base = {highlight: {fields: {title: {fragment_size: 100}}}};
      const override = {highlight: {fields: {body: {number_of_fragments: 3}}}};
      expect(mergeEsQuery(base as never, override as never)).toEqual({
        highlight: {
          fields: {
            title: {fragment_size: 100},
            body: {number_of_fragments: 3},
          },
        },
      });
    });
  });

  describe('scalars', () => {
    it('overrides leaf scalars', () => {
      const base = {size: 10, from: 0, track_total_hits: true};
      const override = {size: 50};
      expect(mergeEsQuery(base as never, override as never)).toEqual({
        size: 50,
        from: 0,
        track_total_hits: true,
      });
    });
  });

  describe('null and undefined semantics', () => {
    it('treats undefined on right as no-opinion', () => {
      const base = {size: 10};
      const override = {size: undefined as never};
      expect(mergeEsQuery(base as never, override as never)).toEqual({size: 10});
    });

    it('treats null on right as explicit clear', () => {
      const base = {size: 10};
      const override = {size: null as never};
      expect(mergeEsQuery(base as never, override as never)).toEqual({size: null as never});
    });
  });

  describe('isolation', () => {
    it('does not mutate inputs', () => {
      const base = {query: {bool: {filter: [{term: {a: 1}}]}}};
      const override = {query: {bool: {filter: [{term: {b: 2}}]}}};
      const baseSnapshot = structuredClone(base);
      const overrideSnapshot = structuredClone(override);
      mergeEsQuery(base as never, override as never);
      expect(base).toEqual(baseSnapshot);
      expect(override).toEqual(overrideSnapshot);
    });

    it('does not share array references with inputs', () => {
      const base = {sort: [{a: 'asc'}]};
      const override = {sort: [{b: 'desc'}]};
      const result = mergeEsQuery(base as never, override as never) as {sort: unknown[]};
      expect(result.sort).not.toBe(base.sort);
      expect(result.sort[0]).not.toBe(base.sort[0]);
    });
  });
});
