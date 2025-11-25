export const extractTags = (content: string): string[] => {
    const tagRegex = /#[^\s#]+/g;
    const matches = content.match(tagRegex);
    return matches ? matches : [];
};

export const determineCategory = (tags: string[]): 'action' | 'thought' => {
    if (tags.includes('#생각')) {
        return 'thought';
    }
    return 'action';
};
