/**
 * @author Titus Wormer
 * @copyright 2014-2015 Titus Wormer
 * @license MIT
 * @module retext:equality:extract
 * @fileoverview Extract and compile database into JSON.
 */

'use strict';

/* eslint-env node */

/*
 * Dependencies.
 */

var fs = require('fs');
var path = require('path');
var duplicated = require('array-duplicated');
var yaml = require('js-yaml');

/*
 * Methods.
 */

var join = path.join;
var read = fs.readFileSync;
var write = fs.writeFileSync;
var stringify = JSON.stringify;

/**
 * Get a unique identifier for a pattern.
 *
 * @param {Object} pattern - Pattern to generate for.
 * @return {string} - Pattern identifier.
 */
function getPatternId(pattern) {
    var inconsiderate = pattern.inconsiderate;
    var phrases = {};
    var result = [];
    var phrase;
    var category;

    for (phrase in inconsiderate) {
        category = inconsiderate[phrase];

        if (!phrases[category] || phrases[category].length > phrase.length) {
            phrases[category] = phrase;
        }
    }

    for (phrase in phrases) {
        result.push(phrases[phrase].replace(/\s/, '-'));
    }

    return result.sort().join('-');
}

/**
 * Patch information on `entry`.
 *
 * @param {Object} entry - Thing.
 */
function patch(entry) {
    var description = entry.note;
    var source = entry.source;
    var result = {
        'id': null,
        'type': entry.type,
        'apostrophe': entry.apostrophe ? true : undefined,
        'categories': entry.categories,
        'considerate': entry.considerate,
        'inconsiderate': entry.inconsiderate
    };

    if (source) {
        if (description) {
            description += ' (source: ' + source + ')';
        } else {
            description = 'Source: ' + source;
        }
    }

    result.note = description;
    result.id = getPatternId(result);

    return result;
}

/*
 * Gather.
 */

var data = [
    'gender',
    'ablist',
    'relationships',
    'lgbtq',
    'suicide'
].map(function (name) {
    return yaml.load(read(join(__dirname, name + '.yml'), 'utf8'));
});

data = [].concat.apply([], data);

/**
 * Clean a value.
 *
 * @param {string|Array.<string>|Object} value - Either a
 *   phrase, list of phrases, or a map of phrases mapping
 *   to categories.
 * @return {Object} - Normalized `value`.
 */
function clean(value) {
    var copy;

    if (typeof value === 'string') {
        value = [value];
    }

    if (value.length) {
        copy = value;
        value = {};

        copy.forEach(function (phrase) {
            value[phrase] = 'a' /* example category */;
        });
    }

    return value;
}

data.forEach(function (entry) {
    entry.inconsiderate = clean(entry.inconsiderate);
    entry.considerate = clean(entry.considerate);
    entry.categories = Object.keys(entry.inconsiderate).map(function (key) {
        return entry.inconsiderate[key];
    }).filter(function (value, index, parent) {
        return parent.indexOf(value, index + 1) === -1;
    });
});

/*
 * Patch.
 */

var phrases = [];

data = data.map(patch);

data.forEach(function (entry) {
    if (entry.type !== 'simple' && entry.categories.length < 2) {
        throw new Error(
            'Utilisez `type: simple` pour les entrées uniques dans une catégorie : ' +
            Object.keys(entry.inconsiderate).join(', ')
        );
    }

    if (entry.inconsiderate) {
        Object.keys(entry.inconsiderate).forEach(function (inconsiderate) {
            phrases.push(inconsiderate);

            if (/-/.test(inconsiderate)) {
                throw new Error(
                    "Évitez d'utiliser des tirets dans les termes maladroits :" +
                    "ils seront retirés quand on recherche des mots : " +
                    Object.keys(entry.inconsiderate).join(', ')
                );
            }

            if (/['’]/.test(inconsiderate) && !entry.apostrophe) {
                throw new Error(
                    "Évitez d'utiliser des apostrophes dans les termes maladroits :" +
                    "ils seront retirés quand on recherche des mots" +
                    "(sinon, veuillez utiliser `apostrophe: true`) :" +
                    Object.keys(entry.inconsiderate).join(', ')
                );
            }
        });
    }
});

var duplicates = duplicated(phrases);

if (duplicates.length) {
    throw new Error(
        "Évitez d'entrer des termes en double :\n" +
        '  ' + duplicates.join(', ')
    );
}

/*
 * Write.
 */

data = stringify(data, 0, 2) + '\n';

write(join(__dirname, '..', 'lib', 'patterns.json'), data);
