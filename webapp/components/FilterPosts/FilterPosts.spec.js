import { mount, createLocalVue } from '@vue/test-utils'
import VTooltip from 'v-tooltip'
import Styleguide from '@human-connection/styleguide'
import Vuex from 'vuex'
import FilterPosts from './FilterPosts.vue'
import locales from '~/locales'
import orderBy from 'lodash/orderBy'

const localVue = createLocalVue()

localVue.use(Styleguide)
localVue.use(VTooltip)
localVue.use(Vuex)

let mutations
let getters

const languages = orderBy(locales, 'name')

describe('FilterPosts.vue', () => {
  let mocks
  let propsData
  let menuToggle
  let allCategoriesButton
  let environmentAndNatureButton
  let democracyAndPoliticsButton
  let happyEmotionButton
  let englishButton
  let spanishButton

  beforeEach(() => {
    mocks = {
      $apollo: {
        query: jest
          .fn()
          .mockResolvedValueOnce({
            data: { Post: { title: 'Post with Category', category: [{ id: 'cat4' }] } },
          })
          .mockRejectedValue({ message: 'We were unable to filter' }),
      },
      $t: jest.fn(),
      $i18n: {
        locale: () => 'en',
      },
      $toast: {
        error: jest.fn(),
      },
    }
    propsData = {
      categories: [
        { id: 'cat4', name: 'Environment & Nature', icon: 'tree' },
        { id: 'cat15', name: 'Consumption & Sustainability', icon: 'shopping-cart' },
        { id: 'cat9', name: 'Democracy & Politics', icon: 'university' },
      ],
    }
  })

  describe('mount', () => {
    mutations = {
      'posts/TOGGLE_FILTER_BY_FOLLOWED': jest.fn(),
      'posts/RESET_CATEGORIES': jest.fn(),
      'posts/TOGGLE_CATEGORY': jest.fn(),
      'posts/TOGGLE_EMOTION': jest.fn(),
      'posts/TOGGLE_LANGUAGE': jest.fn(),
      'posts/RESET_LANGUAGES': jest.fn(),
    }
    getters = {
      'posts/isActive': () => false,
      'auth/isModerator': () => false,
      'auth/user': () => {
        return { id: 'u34' }
      },
      'posts/filteredCategoryIds': jest.fn(() => []),
      'posts/filteredByUsersFollowed': jest.fn(),
      'posts/filteredByEmotions': jest.fn(() => []),
      'posts/filteredLanguageCodes': jest.fn(() => []),
    }
    const openFilterPosts = () => {
      const store = new Vuex.Store({ mutations, getters })
      const wrapper = mount(FilterPosts, { mocks, localVue, propsData, store })
      menuToggle = wrapper.findAll('button').at(0)
      menuToggle.trigger('click')
      return wrapper
    }

    it('groups the categories by pair', () => {
      const wrapper = openFilterPosts()
      expect(wrapper.vm.chunk).toEqual([
        [
          { id: 'cat4', name: 'Environment & Nature', icon: 'tree' },
          { id: 'cat15', name: 'Consumption & Sustainability', icon: 'shopping-cart' },
        ],
        [{ id: 'cat9', name: 'Democracy & Politics', icon: 'university' }],
      ])
    })

    it('starts with all categories button active', () => {
      const wrapper = openFilterPosts()
      allCategoriesButton = wrapper.findAll('button').at(1)
      expect(allCategoriesButton.attributes().class).toContain('ds-button-primary')
    })

    it('calls TOGGLE_CATEGORY when clicked', () => {
      const wrapper = openFilterPosts()
      environmentAndNatureButton = wrapper.findAll('button').at(2)
      environmentAndNatureButton.trigger('click')
      expect(mutations['posts/TOGGLE_CATEGORY']).toHaveBeenCalledWith({}, 'cat4')
    })

    it('calls TOGGLE_LANGUAGE when clicked', () => {
      const wrapper = openFilterPosts()
      englishButton = wrapper
        .findAll('button.language-buttons')
        .at(languages.findIndex(l => l.code === 'en'))
      englishButton.trigger('click')
      expect(mutations['posts/TOGGLE_LANGUAGE']).toHaveBeenCalledWith({}, 'en')
    })

    it('sets category button attribute `primary` when corresponding category is filtered', () => {
      getters['posts/filteredCategoryIds'] = jest.fn(() => ['cat9'])
      const wrapper = openFilterPosts()
      democracyAndPoliticsButton = wrapper.findAll('button').at(4)
      expect(democracyAndPoliticsButton.attributes().class).toContain('ds-button-primary')
    })

    it('sets language button attribute `primary` when corresponding language is filtered', () => {
      getters['posts/filteredLanguageCodes'] = jest.fn(() => ['es'])
      const wrapper = openFilterPosts()
      spanishButton = wrapper
        .findAll('button.language-buttons')
        .at(languages.findIndex(l => l.code === 'es'))
      expect(spanishButton.attributes().class).toContain('ds-button-primary')
    })

    it('sets "filter-by-followed-authors-only" button attribute `primary`', () => {
      getters['posts/filteredByUsersFollowed'] = jest.fn(() => true)
      const wrapper = openFilterPosts()
      expect(
        wrapper.find({ name: 'filter-by-followed-authors-only' }).classes('ds-button-primary'),
      ).toBe(true)
    })

    describe('click "filter-by-followed-authors-only" button', () => {
      let wrapper
      beforeEach(() => {
        wrapper = openFilterPosts()
        wrapper.find({ name: 'filter-by-followed-authors-only' }).trigger('click')
      })

      it('calls TOGGLE_FILTER_BY_FOLLOWED', () => {
        expect(mutations['posts/TOGGLE_FILTER_BY_FOLLOWED']).toHaveBeenCalledWith({}, 'u34')
      })
    })

    describe('click on an "emotions-buttons" button', () => {
      it('calls TOGGLE_EMOTION when clicked', () => {
        const wrapper = openFilterPosts()
        happyEmotionButton = wrapper.findAll('button.emotions-buttons').at(1)
        happyEmotionButton.trigger('click')
        expect(mutations['posts/TOGGLE_EMOTION']).toHaveBeenCalledWith({}, 'happy')
      })

      it('sets the attribute `src` to colorized image', () => {
        getters['posts/filteredByEmotions'] = jest.fn(() => ['happy'])
        const wrapper = openFilterPosts()
        happyEmotionButton = wrapper.findAll('button.emotions-buttons').at(1)
        const happyEmotionButtonImage = happyEmotionButton.find('img')
        expect(happyEmotionButtonImage.attributes().src).toEqual('/img/svg/emoji/happy_color.svg')
      })
    })
  })
})
