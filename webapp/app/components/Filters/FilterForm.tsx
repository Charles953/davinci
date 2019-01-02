import * as React from 'react'
import { FormComponentProps } from 'antd/lib/form/Form'

import Form from 'antd/lib/form'
const FormItem = Form.Item
import Row from 'antd/lib/row'
import Col from 'antd/lib/col'
import Input from 'antd/lib/input'
import Checkbox from 'antd/lib/checkbox'
import Select from 'antd/lib/select'
const Option = Select.Option
import Switch from 'antd/lib/switch'

const utilStyles = require('../../assets/less/util.less')
const styles = require('./filter.less')

import { prefixItem, prefixView, prefixOther } from './constants'
import { OperatorTypes } from 'utils/operatorTypes'
import { FilterTypeList, FilterTypesLocale, FilterTypesViewSetting, FilterTypesOperatorSetting, FilterTypes } from './filterTypes'

import { IModel, IFilterItem } from './'

interface IFilterFormProps {
  views: any[]
  widgets: any[]
  items: any[]
  filterItem: IFilterItem
  onFilterTypeChange: (filterType: FilterTypes) => void
  onFilterItemSave: (filterItem) => void
  onFilterItemNameChange: (key: string, name: string) => void
  onPreviewControl: (filterItem: IFilterItem) => void
}

interface IFilterFormStates {
  usedViews: {
    [viewId: number]: {
      id: number
      name: string
      description: string
      model: [{
        key: string
        visualType: string
        sqlType: string
      }]
      param: string[]
    }

  }
  mappingViewItems: object
  needSetView: boolean
  needSetParentModel: boolean
  modelItems: any[]
  modelOrParam: object,
  availableOperatorTypes: OperatorTypes[]
}

export class FilterForm extends React.Component<IFilterFormProps & FormComponentProps, IFilterFormStates> {

  constructor (props) {
    super(props)
    this.state = {
      usedViews: {},
      mappingViewItems: {},
      needSetView: false,
      needSetParentModel: false,
      modelItems: [],
      modelOrParam: {},
      availableOperatorTypes: []
    }
  }

  public componentWillMount () {
    const { views, widgets, items } = this.props
    if (views && widgets && items) {
      this.initFormSetting(views, widgets, items)
    }
  }

  public componentWillReceiveProps (nextProps: IFilterFormProps) {
    const { views, widgets, items, filterItem } = nextProps

    if (
      views && widgets && items
        && views !== this.props.views
        && widgets !== this.props.widgets
        && items !== this.props.items
    ) {
      this.initFormSetting(views, widgets, items)
    }

    const previousFilterItem = this.props.filterItem
    if (filterItem && filterItem !== previousFilterItem) {
      if (previousFilterItem && previousFilterItem.key) {
        this.saveFilterItem()
      }
    }
  }

  private saveFilterItem = (resolve?: (err?) => void) => {
    const { form, onFilterItemSave, views } = this.props
    const { usedViews, mappingViewItems } = this.state

    form.validateFieldsAndScroll((err, fieldsValue) => {
      if (err) {
        if (resolve) {
          resolve(err)
        }
        return
      }

      const filterItem = {
        relatedViews: {}
      }

      Object.keys(fieldsValue)
        .filter((name) => fieldsValue[name] && name.indexOf(prefixView) >= 0)
        .forEach((name) => {
          const val = fieldsValue[name]
          const viewId = +name.substr(prefixView.length)
          const isParam = !!fieldsValue[prefixOther + viewId]
          const sqlType = isParam ? undefined : usedViews[viewId].model.find((m) => m.key === val).sqlType
          filterItem.relatedViews[viewId] = {
            key: val,
            name: val,
            isParam,
            sqlType,
            items: mappingViewItems[viewId].filter((item) => fieldsValue[prefixItem + item.id]).map((item) => item.id)
          }
        })

      Object.keys(fieldsValue)
        .filter((name) => [prefixItem, prefixView, prefixOther].every((prefix) => name.indexOf(prefix) < 0))
        .forEach((name) => {
          filterItem[name] = fieldsValue[name]
        })

      console.log('saved... ', JSON.parse(JSON.stringify(filterItem)))

      onFilterItemSave(filterItem)
      if (resolve) {
        resolve()
      }
    })
  }

  public setFieldsValue = (filterItem: IFilterItem) => {
    const { views, widgets, items } = this.props
    const { type, fromView, fromModel } = filterItem
    const fieldsValue = {
      ...filterItem,
      relatedViews: undefined
    }
    if (fromView) {
      this.onFromViewChange(fromView, fromModel)
    }
    const { relatedViews } = filterItem
    const modelOrParam = {}
    views.forEach((view) => {
      const viewId = view.id
      if (relatedViews[viewId]) {
        fieldsValue[`${prefixView}${viewId}`] = relatedViews[viewId].key
        fieldsValue[`${prefixOther}${viewId}`] = relatedViews[viewId].isParam
      } else {
        const model = JSON.parse(view.model)
        const defaultKey = Object.keys(model)[0]
        fieldsValue[`${prefixView}${viewId}`] = defaultKey
        fieldsValue[`${prefixOther}${viewId}`] = false
      }
    })
    items.forEach((item) => {
      const itemId = item.id
      const widget = widgets.find((w) => w.id === item.widgetId)
      const { viewId } = widget
      if (relatedViews[viewId]) {
        fieldsValue[`${prefixItem}${itemId}`] = relatedViews[viewId].items.indexOf(itemId) >= 0
        modelOrParam[viewId] = relatedViews[viewId].isParam
      } else {
        fieldsValue[`${prefixItem}${itemId}`] = false
        modelOrParam[viewId] = false
      }
    })
    this.setState({
      needSetView: !!FilterTypesViewSetting[type],
      needSetParentModel: type === FilterTypes.TreeSelect,
      availableOperatorTypes: FilterTypesOperatorSetting[type],
      modelOrParam
    }, () => {
      const { form } = this.props
      form.setFieldsValue(fieldsValue)
    })
  }

  private initFormSetting (views, widgets, items) {
    const varReg = /query@var\s+\$(\w+)\$/g
    const usedViews = {}
    const mappingViewItems = {}
    items.forEach((item) => {
      const { widgetId } = item
      const widget = widgets.find((w) => w.id === widgetId)
      const { viewId } = widget
      if (!usedViews[viewId]) {
        const view = views.find((v) => v.id === viewId)
        const { id, name, description, model, sql } = view
        const modelObj = JSON.parse(model) as IModel
        usedViews[viewId] = {
          id,
          name,
          description,
          model: Object.entries(modelObj).map(([key, { sqlType, visualType }]) => ({
            key,
            visualType,
            sqlType
          })),
          param: (sql.match(varReg) || []).map((qv) => qv.substring(qv.indexOf('$') + 1, qv.length - 1))
        }
      }
      if (!mappingViewItems[viewId]) {
        mappingViewItems[viewId] = []
      }
      mappingViewItems[viewId].push({
        id: item.id,
        name: widget.name
      })
    })
    this.setState({
      usedViews,
      mappingViewItems
    })
  }

  private filterItemNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { onFilterItemNameChange, filterItem } = this.props
    const name = e.target.value
    onFilterItemNameChange(filterItem.key, name)
  }

  private modelOrParamChange = (viewId) => (isParam) => {
    const { modelOrParam, usedViews } = this.state
    const { param, model } = usedViews[viewId]
    const options = isParam ? param : model
    const newVal = options.length <= 0 ? null : (isParam ? param[0] : model[0].key)
    this.setState({
      modelOrParam: {
        ...modelOrParam,
        [viewId]: isParam
      }
    }, () => {
      this.props.form.setFieldsValue({ [`${prefixView}${viewId}`]: newVal })
    })
  }

  private renderConfigItem (viewId, usedViews, mappingViewItems) {
    const { form } = this.props
    const { modelOrParam } = this.state
    const { getFieldDecorator } = form
    const view = usedViews[viewId]
    const items = mappingViewItems[viewId]

    const modelOrParamSelect = (
      <Select>
        {
          modelOrParam[viewId] ? (
            view.param.map((p) => (
              <Option key={p} value={p}>{p}</Option>
            ))
          ) : (
            view.model.map((m) => (
              <Option key={m.key} value={m.key}>{m.key}</Option>
            ))
          )
        }
      </Select>
    )

    return (
      <Row key={viewId} className={styles.configItem}>
        <Col span={8} className={styles.itemList}>
          {
            items.map((item) => (
              <FormItem
                className={styles.item}
                key={item.id}
                label={item.name}
                labelCol={{span: 21}}
                wrapperCol={{span: 3}}
              >
                {getFieldDecorator(`${prefixItem}${item.id}`, {
                  valuePropName: 'checked'
                })(
                  <Checkbox />
                )}
              </FormItem>
            ))
          }
        </Col>
        <Col span={16} className={styles.viewSet}>
          <FormItem
            className={styles.item}
            label="参数"
            labelCol={{span: 12}}
            wrapperCol={{span: 12}}
          >
            {getFieldDecorator(`${prefixOther}${view.id}`, {
              valuePropName: 'checked'
            })(<Switch onChange={this.modelOrParamChange(viewId)}/>)}
          </FormItem>
          <FormItem
            className={styles.item}
            label={view.name}
            labelCol={{span: 12}}
            wrapperCol={{span: 12}}
          >
            {getFieldDecorator(`${prefixView}${view.id}`)(modelOrParamSelect)}
          </FormItem>
        </Col>
      </Row>
    )
  }

  private onFromViewChange = (viewId, fromModel) => {
    const { views } = this.props
    const view = views.find((v) => v.id === +viewId)
    const modelItems = Object.entries(JSON.parse(view.model))
      .filter(([_, desc]) => (desc as any).modelType === 'category')
      .map(([key]) => key)
    this.setState({
      modelItems
    }, () => {
      const { form } = this.props
      if (!fromModel || modelItems.indexOf(fromModel) < 0) {
        form.setFieldsValue({
          fromModel: modelItems[0], fromText: modelItems[0],
          fromParent: null, fromChild: null
        })
      }
    })
  }

  private onFromModelChange = (fromModel) => {
    this.props.form.setFieldsValue({ fromModel, fromText: fromModel })
  }

  private filterTypeChange = (val) => {
    this.setState({
      needSetView: FilterTypesViewSetting[val],
      needSetParentModel: val === FilterTypes.TreeSelect,
      availableOperatorTypes: FilterTypesOperatorSetting[val]
    }, () => {
      const { form } = this.props
      const { availableOperatorTypes } = this.state
      const operator = form.getFieldValue('operator')
      if (availableOperatorTypes.indexOf(operator) < 0) {
        form.setFieldsValue({ operator: availableOperatorTypes[0] })
      }
    })

    const { onFilterTypeChange } = this.props
    onFilterTypeChange(val)
  }

  private renderConfigForm (usedViews, mappingViewItems) {
    const { form, views } = this.props
    const { getFieldDecorator } = form
    const { needSetView, needSetParentModel, modelItems, availableOperatorTypes } = this.state

    return (
      <div className={styles.filterForm}>
        <div className={styles.title}><h2>配置</h2></div>
        <div className={styles.formContent}>
          <Form className={styles.form}>
            <Row>
              <Col span={12}>
                <FormItem className={utilStyles.hide}>
                  {getFieldDecorator('key', {})(<Input />)}
                </FormItem>
                <FormItem
                  label="名称"
                  labelCol={{span: 8}}
                  wrapperCol={{span: 16}}
                >
                  {
                    getFieldDecorator('name', {
                      rules: [{
                        required: true,
                        message: '不能为空'
                      }]
                    })(
                      <Input onChange={this.filterItemNameChange} placeholder="筛选项名称" />
                    )
                  }
                </FormItem>
              </Col>
              <Col span={12}>
                <FormItem
                  label="类型"
                  labelCol={{span: 8}}
                  wrapperCol={{span: 16}}
                >
                  {
                    getFieldDecorator('type', {
                      rules: [{
                        required: true,
                        message: '不能为空'
                      }]
                    })(
                      <Select
                        onChange={this.filterTypeChange}
                      >
                        {
                          FilterTypeList.map((filterType) => (
                            <Option key={filterType} value={filterType}>{FilterTypesLocale[filterType]}</Option>
                          ))
                        }
                      </Select>
                    )
                  }
                </FormItem>
              </Col>
              {
                !needSetView ? null : (
                  <>
                    <Col span={12}>
                        <FormItem
                          label="来源 View"
                          labelCol={{span: 8}}
                          wrapperCol={{span: 16}}
                        >
                          {
                            getFieldDecorator('fromView', {
                              rules: [{
                                required: true,
                                message: '不能为空'
                              }]
                            })(
                              <Select
                                onChange={this.onFromViewChange}
                              >
                                {
                                  views.map((view) => (
                                    <Option key={view.id} value={view.id.toString()}>{view.name}</Option>
                                  ))
                                }
                              </Select>
                            )
                          }
                        </FormItem>
                    </Col>
                    <Col span={12}>
                      <FormItem
                          label="值字段"
                          labelCol={{span: 8}}
                          wrapperCol={{span: 16}}
                      >
                        {
                          getFieldDecorator('fromModel', {
                            rules: [{
                              required: true,
                              message: '不能为空'
                            }]
                          })(
                            <Select onChange={this.onFromModelChange}>
                              {
                                modelItems.map((itemName) => (
                                  <Option key={itemName} value={itemName}>{itemName}</Option>
                                ))
                              }
                            </Select>
                          )
                        }
                      </FormItem>
                    </Col>
                    <Col span={12}>
                      <FormItem
                          label="文本字段"
                          labelCol={{span: 8}}
                          wrapperCol={{span: 16}}
                      >
                        {
                          getFieldDecorator('fromText', {
                            rules: [{
                              required: true,
                              message: '不能为空'
                            }]
                          })(
                            <Select>
                              {
                                modelItems.map((itemName) => (
                                  <Option key={itemName} value={itemName}>{itemName}</Option>
                                ))
                              }
                            </Select>
                          )
                        }
                      </FormItem>
                    </Col>
                    {
                      !needSetParentModel ? null : (
                        <>
                          <Col span={12}>
                            <FormItem
                                label="子级字段"
                                labelCol={{span: 8}}
                                wrapperCol={{span: 16}}
                            >
                              {
                                getFieldDecorator('fromChild', {
                                  rules: [{
                                    required: true,
                                    message: '不能为空'
                                  }, {
                                    validator: (_, value: string, callback) => {
                                      const fromParent = this.props.form.getFieldValue('fromParent')
                                      value === fromParent ? callback('子级字段不能与父级字段相同') : callback()
                                    }
                                  }]
                                })(
                                  <Select>
                                    {
                                      modelItems.map((itemName) => (
                                        <Option key={itemName} value={itemName}>{itemName}</Option>
                                      ))
                                    }
                                  </Select>
                                )
                              }
                            </FormItem>
                          </Col>
                          <Col span={12}>
                            <FormItem
                                label="父级字段"
                                labelCol={{span: 8}}
                                wrapperCol={{span: 16}}
                            >
                              {
                                getFieldDecorator('fromParent', {
                                  rules: [{
                                    required: true,
                                    message: '不能为空'
                                  }, {
                                    validator: (_, value: string, callback) => {
                                      const fromChild = this.props.form.getFieldValue('fromChild')
                                      value === fromChild ? callback('父级字段不能与子级字段相同') : callback()
                                    }
                                  }]
                                })(
                                  <Select>
                                    {
                                      modelItems.map((itemName) => (
                                        <Option key={itemName} value={itemName}>{itemName}</Option>
                                      ))
                                    }
                                  </Select>
                                )
                              }
                            </FormItem>
                          </Col>
                        </>
                      )
                    }
                  </>
                )
              }
            {
              availableOperatorTypes.length <= 0 ? null : (
                <Col span={12}>
                    <FormItem
                      label="对应关系"
                      labelCol={{span: 8}}
                      wrapperCol={{span: 16}}
                    >
                      {
                        getFieldDecorator('operator', {
                          rules: [{
                            required: true,
                            message: '不能为空'
                          }]
                        })(
                          <Select>
                            {
                              availableOperatorTypes.map((operatorType) => (
                                <Option key={operatorType} value={operatorType}>{operatorType}</Option>
                              ))
                            }
                          </Select>
                        )
                      }
                    </FormItem>
                </Col>
              )
            }
            </Row>
            <Row>
              <Col span={24}>
                {Object.keys(usedViews).map((viewId) => this.renderConfigItem(viewId, usedViews, mappingViewItems))}
              </Col>
            </Row>
          </Form>
        </div>
      </div>
    )
  }

  public render () {
    const { views, widgets, items } = this.props
    if (views && widgets && items) {
      const { usedViews, mappingViewItems } = this.state
      return this.renderConfigForm(usedViews, mappingViewItems)
    }
    return null
  }
}

export default Form.create<IFilterFormProps>({
  onValuesChange: (props: IFilterFormProps, changedValues, allValues) => {
    const changedKeys = ['type', 'name', 'fromModel', 'fromText', 'fromParent', 'fromChild']
    const refreshPreview = Object.keys(changedValues).some((key) => changedKeys.includes(key))
    if (!refreshPreview) { return }
    const { onPreviewControl } = props
    onPreviewControl(allValues as IFilterItem)
  }
})(FilterForm)
