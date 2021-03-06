const EventEmitter = require('./emitter');


class GetterException {

  inlineExpression(expression) {
    return Object.keys(expression || {}).map((name) => `${name}=${expression[name]}`).join(',');
  }

}

class DoesNotExist extends GetterException {

  constructor(expression) {
    super();
    this.name = 'DoesNotExist';
    this.message = `Could not find object with (${this.inlineExpression(expression)})`;
  }

}

class MoreThanOneValue extends GetterException {

  constructor(expression) {
    super();
    this.name = 'MoreThanOneValue';
    this.message = `Found more than one object with (${this.inlineExpression(expression)})`;
  }

}

class NotInSchema {

  constructor(name) {
    this.name = 'NotInSchema';
    this.message = `Model has no '${name}' in schema`;
  }

}


class QuerySet extends EventEmitter {

  constructor(opts = {}) {
    super();
    this.orderedBy = opts.orderedBy || null;
    this.predicate = opts.predicate || null;
    this.prefilters = opts.prefilters || [];
    this.ModelType = opts.ModelType;
    this.generator = opts.generator;
  }

  matchExpression(values, expression) {
    let match = true;

    for (const name of Object.keys(expression)) {
      if (! (name in values) || values[name] !== expression[name]) {
        match = false;
        break;
      }
    }

    return match;
  }

  assertInSchema(name) {
    if (! this.ModelType.schema.has(name)) throw new NotInSchema(name);
  }

  assertExpressionInSchema(expression) {
    for (const name of Object.keys(expression)) {
      this.assertInSchema(name);
    }
  }

  _extractPrefilters(expression) {
    const prefilters = [];

    for (const name of Object.keys(expression)) {
      const val = expression[name];

      if (this.ModelType.schema.isIndexed(name)) {
        prefilters.push({name, val});
      }
    }

    return prefilters;
  }

  filter(expression) {
    this.assertExpressionInSchema(expression);

    return new QuerySet({
      predicate: (values) => this.matchExpression(values, expression),
      prefilters: this._extractPrefilters(expression),
      generator: (prefilters) => this.entries(prefilters),
      ModelType: this.ModelType,
    });
  }

  exclude(expression) {
    this.assertExpressionInSchema(expression);

    return new QuerySet({
      predicate: (values) => !this.matchExpression(values, expression),
      generator: (prefilters) => this.entries(prefilters),
      ModelType: this.ModelType,
    });
  }

  orderBy(name) {
    this.assertInSchema(name);

    return new QuerySet({
      orderedBy: name,
      generator: (prefilters) => this.entries(prefilters),
      ModelType: this.ModelType,
    });
  }

  sort(entry1, entry2) {
    let result = 0;
    const sortable = !!this.orderedBy
      && (this.orderedBy in entry1)
      && (this.orderedBy in entry2)
      && (typeof entry1[this.orderedBy] === typeof entry2[this.orderedBy]);

    if (sortable) {
      switch (typeof entry1[this.orderedBy]) {
        case 'string':
          result = entry1[this.orderedBy].localeCompare(entry2[this.orderedBy]);
          break;

        case 'number':
          result = entry1[this.orderedBy] - entry2[this.orderedBy];
          break;

        default:
          break;
      }
    }

    return result;
  }

  *entries(prefilters = []) {
    const mixedPrefilters = this.prefilters.concat(prefilters);
    const entries = !!this.orderedBy ? [...this.generator(mixedPrefilters)].sort(
      (entry1, entry2) => this.sort(entry1, entry2)
    ) : this.generator(mixedPrefilters);

    for (const entry of entries) {
      if (!this.predicate || this.predicate(entry.values())) yield entry;
    }
  }

  values(opts) {
    return this.all().map(model => model.values(opts));
  }

  all() {
    return [...this.entries()];
  }

  first() {
    return this.entries().next().value;
  }

  count() {
    return this.all().length;
  }

  delete() {
    this.all().forEach((entry) => entry.delete());
  }

  get(expression) {
    const iterator = !!expression ? this.filter(expression).entries() : this.entries();
    const entry = iterator.next();

    if (entry.value === undefined) throw new DoesNotExist(expression);
    if (!iterator.next().done) throw new MoreThanOneValue(expression);

    return entry.value;
  }

}

module.exports = QuerySet;
