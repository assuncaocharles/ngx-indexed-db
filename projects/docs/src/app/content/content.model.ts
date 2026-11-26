export interface Heading {
  id: string;
  text: string;
  level: 2 | 3;
}

export interface GuideMeta {
  slug: string;
  title: string;
  description: string;
  section: string;
}

export interface GuidePage extends GuideMeta {
  html: string;
  headings: Heading[];
}

export interface ApiIndexGroup {
  id: string;
  title: string;
  methods: string[];
}

export interface ApiParam {
  name: string;
  type: string;
  optional: boolean;
  description: string;
}

export interface ApiMethod {
  name: string;
  signature: string;
  signatureHtml: string;
  summary: string;
  summaryHtml: string;
  params: ApiParam[];
  returns: string;
  returnsDoc: string;
  bodyHtml: string;
}

export interface ApiGroup {
  id: string;
  title: string;
  methods: ApiMethod[];
}

export interface ApiType {
  name: string;
  kind: 'interface' | 'enum' | 'type' | 'token';
  summary: string;
  summaryHtml: string;
  html: string;
  notes: string;
}

export interface SearchEntry {
  title: string;
  section: string;
  url: string;
  text: string;
}
