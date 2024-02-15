import { Document, Query } from "mongoose";

interface QueryString {
  [key: string]: string;
}
class APIFeatures<T extends Document> {
  query: Query<T[], T>;
  queryString: QueryString;

  constructor(query: Query<T[], T>, queryString: QueryString) {
    this.query = query;
    this.queryString = queryString;
  }

  filter(): this {
    const queryObj = { ...this.queryString };
    const excludedFields: string[] = ["page", "sort", "limit", "fields"];
    excludedFields.forEach((el: string) => delete queryObj[el]);

    let queryStr: string = JSON.stringify(queryObj);
    queryStr = queryStr.replace(
      /\b(gte|gt|lte|lt)\b/g,
      (match: string) => `$${match}`
    );

    this.query = this.query.find(JSON.parse(queryStr));

    return this;
  }

  advancedFilter(): this {
    const queryObj = { ...this.queryString };
    const excludedFields: string[] = ["page", "sort", "limit", "fields"];
    excludedFields.forEach((el: string) => delete queryObj[el]);

    let queryStr: string = JSON.stringify(queryObj);
    queryStr = queryStr.replace(
      /\b(in|nin)\b/g,
      (match: string) => `$${match}`
    );

    this.query = this.query.find(JSON.parse(queryStr));

    return this;
  }

  sort(): this {
    if (this.queryString.sort) {
      const sortBy: string = this.queryString.sort.split(",").join(" ");
      this.query = this.query.sort(sortBy);
    }
    return this;
  }

  limitFields(): this {
    if (this.queryString.fields) {
      const fields: string = this.queryString.fields.split(",").join(" ");
      this.query = this.query.select(fields);
    } else {
      this.query = this.query.select("-__v");
    }

    return this;
  }

  paginate(): this {
    const page: number = this.queryString.page
      ? parseInt(this.queryString.page)
      : 1;
    const limit: number = this.queryString.limit
      ? parseInt(this.queryString.limit)
      : 10;
    const skip: number = (page - 1) * limit;

    this.query = this.query.skip(skip).limit(limit);

    return this;
  }
}

export { APIFeatures, QueryString };
